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
    let folder = nodePath.dirname(action.filePath).replace(/\/+$/g, '');
    if (folder !== '.') await webcontainer.fs.mkdir(folder, { recursive: true });
    await webcontainer.fs.writeFile(action.filePath, action.content);
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    this.actions.setKey(id, { ...this.actions.get()[id], ...newState });
  }
}