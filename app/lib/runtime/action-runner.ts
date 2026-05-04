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

    // Compute diff stats for edited files
    let additions = 0;
    let deletions = 0;
    if (!isNewFile && prevContent) {
      const oldLines = prevContent.split('\n');
      const newLines = action.content.split('\n');
      // Simple line-based diff using Set comparison for uniqueness
      const oldSet = new Set(oldLines);
      const newSet = new Set(newLines);
      // Count lines added (in new but not in old)
      for (const line of newLines) {
        if (!oldSet.has(line)) {
          additions++;
        }
      }
      // Count lines removed (in old but not in new)
      for (const line of oldLines) {
        if (!newSet.has(line)) {
          deletions++;
        }
      }
    } else if (isNewFile) {
      additions = action.content.split('\n').filter((l) => l.trim()).length;
    }

    let folder = nodePath.dirname(action.filePath).replace(/\/+$/g, '');
    if (folder !== '.') await wc.fs.mkdir(folder, { recursive: true });
    await wc.fs.writeFile(action.filePath, action.content);

    // Update action state with isNewFile and diff stats
    const actionId = Object.entries(this.actions.get()).find(([, a]) => a === action)?.[0];
    if (actionId) {
      this.#updateAction(actionId, { isNewFile, additions, deletions } as any);
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    this.actions.setKey(id, { ...this.actions.get()[id], ...newState });
  }
}