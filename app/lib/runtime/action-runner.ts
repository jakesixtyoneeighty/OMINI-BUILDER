import { WebContainer } from '@webcontainer/api';
import { map, type MapStore } from 'nanostores';
import * as nodePath from 'node:path';
import type { BoltAction, FileAction } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
  isNewFile?: boolean;
  additions?: number;
  deletions?: number;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type ActionStateUpdate =
  | Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>
  | (Omit<Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();

  actions: ActionsMap = map({});

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;
    const actions = this.actions.get();
    if (actions[actionId]) return;

    const abortController = new AbortController();
    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });
  }

  async runAction(data: ActionCallbackData) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];
    if (!action || action.executed) return;

    this.#updateAction(actionId, { ...action, ...data.action, executed: true });
    this.#currentExecutionPromise = this.#currentExecutionPromise.then(() => this.#executeAction(actionId));
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];
    this.#updateAction(actionId, { status: 'running' });
    try {
      if (action.type === 'shell') await this.#runShellAction(action);
      else await this.#runFileAction(action);
      this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
    } catch (error) {
      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    const webcontainer = await this.#webcontainer;
    const process = await webcontainer.spawn('jsh', ['-c', action.content], { env: { npm_config_yes: true } });
    action.abortSignal.addEventListener('abort', () => process.kill());
    await process.exit;
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') return;

    const webcontainer = await this.#webcontainer;
    const wc = await webcontainer;

    const actionId = Object.entries(this.actions.get()).find(([, a]) => a === action)?.[0];

    // Check if file already exists to determine if it's new or edited
    let isNewFile = true;
    let prevContent = '';
    try {
      const existing = await wc.fs.readFile(action.filePath);
      prevContent = existing;
      isNewFile = false;
    } catch {
      isNewFile = true;
    }

    let finalContent: string;
    let additions = 0;
    let deletions = 0;
    const mode = (action as FileAction).mode;

    if (mode === 'edit' && !isNewFile) {
      // PARTIAL EDIT MODE: apply search/replace blocks to existing file
      const result = applySearchReplace(prevContent, action.content);
      if (result.error) {
        // If search/replace fails, fall back to full file write instead of throwing
        logger.warn(`Search/replace failed for ${action.filePath}: ${result.error}. Falling back to full file write.`);
        finalContent = action.content;
        const oldLines = prevContent.split('\n');
        const newLines = finalContent.split('\n');
        const oldSet = new Set(oldLines);
        const newSet = new Set(newLines);
        for (const line of newLines) { if (!oldSet.has(line)) additions++; }
        for (const line of oldLines) { if (!newSet.has(line)) deletions++; }
      } else {
        finalContent = result.content;
        additions = result.additions;
        deletions = result.deletions;
      }
    } else {
      // FULL FILE MODE (default or new file)
      finalContent = action.content;

      // Compute diff stats for edited files
      if (!isNewFile && prevContent) {
        const oldLines = prevContent.split('\n');
        const newLines = finalContent.split('\n');
        const oldSet = new Set(oldLines);
        const newSet = new Set(newLines);
        for (const line of newLines) {
          if (!oldSet.has(line)) additions++;
        }
        for (const line of oldLines) {
          if (!newSet.has(line)) deletions++;
        }
      } else if (isNewFile) {
        additions = finalContent.split('\n').filter((l) => l.trim()).length;
      }
    }

    // Ensure parent directories exist (recursive mkdir is safe even if they exist)
    let folder = nodePath.dirname(action.filePath).replace(/\/+$/g, '');
    if (folder !== '.') {
      try {
        await wc.fs.mkdir(folder, { recursive: true });
      } catch (mkdirErr) {
        logger.warn(`mkdir failed for ${folder}, attempting to write file anyway:`, mkdirErr);
      }
    }

    try {
      await wc.fs.writeFile(action.filePath, finalContent);
    } catch (writeErr) {
      // Retry once after a short delay (WebContainer can have race conditions)
      logger.warn(`First write attempt failed for ${action.filePath}, retrying in 500ms...`);
      await new Promise((r) => setTimeout(r, 500));
      try {
        // Try mkdir again in case it was a race condition
        if (folder !== '.') {
          await wc.fs.mkdir(folder, { recursive: true });
        }
        await wc.fs.writeFile(action.filePath, finalContent);
      } catch (retryErr) {
        throw new Error(`Failed to write ${action.filePath}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
      }
    }

    // Update action state with isNewFile, mode, and diff stats
    if (actionId) {
      this.#updateAction(actionId, { isNewFile, additions, deletions } as any);
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    this.actions.setKey(id, { ...this.actions.get()[id], ...newState });
  }
}

/**
 * Apply search/replace blocks to existing content.
 *
 * Format:
 * <<<<<<< SEARCH
 * text to find (exact match)
 * =======
 * replacement text
 * >>>>>>> REPLACE
 *
 * Multiple blocks are supported.
 */
function applySearchReplace(
  originalContent: string,
  patchContent: string,
): { content: string; additions: number; deletions: number; error?: string } {
  const SEARCH_MARKER = '<<<<<<< SEARCH';
  const DIVIDER_MARKER = '=======';
  const REPLACE_MARKER = '>>>>>>> REPLACE';

  const blocks = patchContent.split(SEARCH_MARKER).slice(1);

  if (blocks.length === 0) {
    return {
      content: originalContent,
      additions: 0,
      deletions: 0,
      error: 'No search/replace blocks found. Use <<<<<<< SEARCH / ======= / >>>>>>> REPLACE format.',
    };
  }

  let content = originalContent;
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const dividerIndex = block.indexOf(DIVIDER_MARKER);
    const replaceIndex = block.indexOf(REPLACE_MARKER);

    if (dividerIndex === -1 || replaceIndex === -1) {
      return {
        content: originalContent,
        additions: 0,
        deletions: 0,
        error: `Block #${i + 1} is malformed — missing ======= or >>>>>>> REPLACE marker.`,
      };
    }

    const searchText = block.substring(0, dividerIndex);
    const replaceText = block.substring(dividerIndex + DIVIDER_MARKER.length, replaceIndex);

    // Normalize line endings for matching
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedSearch = searchText.replace(/\r\n/g, '\n').trim();
    const normalizedReplace = replaceText.replace(/\r\n/g, '\n');

    if (!normalizedContent.includes(normalizedSearch)) {
      // Try without trimming the search text
      const untrimmedSearch = searchText.replace(/\r\n/g, '\n');
      if (normalizedContent.includes(untrimmedSearch)) {
        const newContent = normalizedContent.replace(untrimmedSearch, normalizedReplace);
        const oldLines = untrimmedSearch.split('\n').filter((l) => l.length > 0).length;
        const newLines = normalizedReplace.split('\n').filter((l) => l.length > 0).length;
        totalDeletions += oldLines;
        totalAdditions += newLines;
        content = newContent;
        continue;
      }

      return {
        content: originalContent,
        additions: 0,
        deletions: 0,
        error: `Block #${i + 1}: search text not found in file. The content to replace may have changed.`,
      };
    }

    const oldLines = normalizedSearch.split('\n').filter((l) => l.length > 0).length;
    const newLines = normalizedReplace.split('\n').filter((l) => l.length > 0).length;
    totalDeletions += oldLines;
    totalAdditions += newLines;

    content = normalizedContent.replace(normalizedSearch, normalizedReplace);
  }

  return {
    content,
    additions: totalAdditions,
    deletions: totalDeletions,
  };
}
