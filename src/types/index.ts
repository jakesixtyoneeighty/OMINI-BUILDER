// ============================================================
// Omni-Builder — Core Type Definitions
// ============================================================

/** Represents a single file in the project virtual filesystem */
export interface ProjectFile {
  path: string;        // e.g. "src/App.tsx"
  content: string;
  language: string;    // derived from extension
}

/** The full project state */
export interface Project {
  id: string;
  name: string;
  description: string;
  files: Record<string, ProjectFile>; // keyed by path
  createdAt: number;
  updatedAt: number;
}

/** A single chat message from the user or AI */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** If the assistant produced files, store them here */
  artifacts?: FileArtifact[];
  /** Whether the message is still streaming */
  isStreaming?: boolean;
}

/** A file artifact produced by the AI */
export interface FileArtifact {
  path: string;
  content: string;
  action: 'create' | 'update' | 'delete';
  /** For updates, which lines changed */
  diff?: string;
}

/** A tree node used by the FileExplorer */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  language?: string;
}

/** Status of the current build / preview */
export type PreviewStatus = 'idle' | 'building' | 'ready' | 'error';

/** Deployment status */
export type DeployStatus = 'idle' | 'deploying' | 'success' | 'error';

/** The shape of the AI response from the /api/generate endpoint */
export interface GenerateResponse {
  message: string;
  artifacts: FileArtifact[];
}

/** Streaming chunk from the AI */
export interface StreamChunk {
  type: 'text' | 'file_start' | 'file_content' | 'file_end' | 'done' | 'error';
  data: string;
  path?: string;
}

/** Template presets */
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: Record<string, string>;
}

/** Editor tab */
export interface EditorTab {
  id: string;
  path: string;
  isDirty: boolean;
}
