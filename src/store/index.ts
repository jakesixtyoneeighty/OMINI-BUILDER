// ============================================================
// Omni-Builder — Project Store (Zustand)
// ============================================================
import { create } from 'zustand';
import type {
  Project,
  ProjectFile,
  FileTreeNode,
  PreviewStatus,
  DeployStatus,
  EditorTab,
  FileArtifact,
} from '@/types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Derive language from file extension */
export function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript',
    jsx: 'javascriptreact', css: 'css', html: 'html', json: 'json',
    md: 'markdown', yaml: 'yaml', yml: 'yaml', svg: 'xml',
    xml: 'xml', txt: 'text', env: 'text', sh: 'shell',
    py: 'python', rs: 'rust', go: 'go',
  };
  return map[ext] ?? 'text';
}

/** Build a tree from flat file map */
function buildTree(files: Record<string, ProjectFile>): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  const sortedPaths = Object.keys(files).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');

      let existing = current.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: fullPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          language: isFile ? getLanguage(part) : undefined,
        };
        current.push(existing);
      }
      current = existing.children ?? [];
    }
  }

  return root;
}

interface ProjectStore {
  // ---- Project ----
  project: Project;
  setProjectName: (name: string) => void;
  setProjectDescription: (desc: string) => void;

  // ---- Files ----
  getFile: (path: string) => ProjectFile | undefined;
  setFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  applyArtifacts: (artifacts: FileArtifact[]) => void;
  getFileTree: () => FileTreeNode[];
  getAllFiles: () => ProjectFile[];

  // ---- Reset ----
  resetProject: (name?: string) => void;
  loadProject: (files: Record<string, string>) => void;
}

const DEFAULT_PROJECT: Project = {
  id: generateId(),
  name: 'Untitled Project',
  description: '',
  files: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: { ...DEFAULT_PROJECT },

  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name, updatedAt: Date.now() } })),

  setProjectDescription: (desc) =>
    set((s) => ({ project: { ...s.project, description: desc, updatedAt: Date.now() } })),

  getFile: (path) => get().project.files[path],

  setFile: (path, content) =>
    set((s) => ({
      project: {
        ...s.project,
        files: {
          ...s.project.files,
          [path]: { path, content, language: getLanguage(path) },
        },
        updatedAt: Date.now(),
      },
    })),

  deleteFile: (path) =>
    set((s) => {
      const files = { ...s.project.files };
      delete files[path];
      return { project: { ...s.project, files, updatedAt: Date.now() } };
    }),

  applyArtifacts: (artifacts) =>
    set((s) => {
      const files = { ...s.project.files };
      for (const art of artifacts) {
        if (art.action === 'delete') {
          delete files[art.path];
        } else {
          files[art.path] = {
            path: art.path,
            content: art.content,
            language: getLanguage(art.path),
          };
        }
      }
      return { project: { ...s.project, files, updatedAt: Date.now() } };
    }),

  getFileTree: () => buildTree(get().project.files),

  getAllFiles: () => Object.values(get().project.files),

  resetProject: (name) =>
    set({
      project: {
        ...DEFAULT_PROJECT,
        id: generateId(),
        name: name ?? 'Untitled Project',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    }),

  loadProject: (files) =>
    set((s) => {
      const parsed: Record<string, ProjectFile> = {};
      for (const [path, content] of Object.entries(files)) {
        parsed[path] = { path, content, language: getLanguage(path) };
      }
      return {
        project: { ...s.project, files: parsed, updatedAt: Date.now() },
      };
    }),
}));

// ============================================================
// Editor Store
// ============================================================
interface EditorStore {
  openTabs: EditorTab[];
  activeTab: string | null;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  openTabs: [],
  activeTab: null,

  openFile: (path) => {
    const { openTabs } = get();
    const existing = openTabs.find((t) => t.path === path);
    if (!existing) {
      set({
        openTabs: [...openTabs, { id: generateId(), path, isDirty: false }],
        activeTab: path,
      });
    } else {
      set({ activeTab: path });
    }
  },

  closeTab: (path) =>
    set((s) => {
      const tabs = s.openTabs.filter((t) => t.path !== path);
      let active = s.activeTab;
      if (active === path) {
        const idx = s.openTabs.findIndex((t) => t.path === path);
        active = tabs[Math.min(idx, tabs.length - 1)]?.path ?? null;
      }
      return { openTabs: tabs, activeTab: active };
    }),

  setActiveTab: (path) => set({ activeTab: path }),

  markDirty: (path) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.path === path ? { ...t, isDirty: true } : t
      ),
    })),

  markClean: (path) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.path === path ? { ...t, isDirty: false } : t
      ),
    })),
}));

// ============================================================
// Chat Store
// ============================================================
interface ChatStore {
  messages: ChatMessage[];
  isGenerating: boolean;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void;
  clearChat: () => void;
  setIsGenerating: (v: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isGenerating: false,

  addMessage: (msg) => {
    const id = generateId();
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id, timestamp: Date.now() },
      ],
    }));
    return id;
  },

  updateMessage: (id, partial) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    })),

  clearChat: () => set({ messages: [] }),
  setIsGenerating: (v) => set({ isGenerating: v }),
}));

// ============================================================
// Preview Store
// ============================================================
interface PreviewStore {
  status: PreviewStatus;
  error: string | null;
  url: string | null;
  setStatus: (s: PreviewStatus) => void;
  setError: (e: string | null) => void;
  setUrl: (u: string | null) => void;
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  status: 'idle',
  error: null,
  url: null,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setUrl: (url) => set({ url }),
}));

// ============================================================
// Deploy Store
// ============================================================
interface DeployStore {
  status: DeployStatus;
  url: string | null;
  error: string | null;
  logs: string[];
  setStatus: (s: DeployStatus) => void;
  setUrl: (u: string | null) => void;
  setError: (e: string | null) => void;
  addLog: (l: string) => void;
  reset: () => void;
}

export const useDeployStore = create<DeployStore>((set) => ({
  status: 'idle',
  url: null,
  error: null,
  logs: [],
  setStatus: (status) => set({ status }),
  setUrl: (url) => set({ url }),
  setError: (error) => set({ error }),
  addLog: (log) => set((s) => ({ logs: [...s.logs, log] })),
  reset: () => set({ status: 'idle', url: null, error: null, logs: [] }),
}));

// Re-import ChatMessage type used in ChatStore
import type { ChatMessage } from '@/types';
