export type ActionType = 'file' | 'shell';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
  /**
   * 'create' = full file content (default)
   * 'edit' = search/replace blocks (partial edit)
   */
  mode?: 'create' | 'edit';
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export type BoltAction = FileAction | ShellAction;

export type BoltActionData = BoltAction | BaseAction;
