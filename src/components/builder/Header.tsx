// ============================================================
// Omni-Builder — Header Component
// ============================================================
'use client';

import { useState, useCallback, useRef } from 'react';
import { useProjectStore, useChatStore, useEditorStore, useAIProviderStore } from '@/store';
import { TEMPLATES } from '@/services/templates';
import { AI_PROVIDERS } from '@/services/ai-providers';
import type { ProjectTemplate } from '@/types';
import {
  Rocket,
  Download,
  Upload,
  RotateCcw,
  ChevronDown,
  Zap,
  Eye,
  Terminal,
  Settings,
  FileCode,
  KeyRound,
} from 'lucide-react';
import SettingsDialog from './SettingsDialog';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onToggleTerminal: () => void;
  terminalOpen: boolean;
  activeView: 'chat' | 'preview';
  onViewChange: (view: 'chat' | 'preview') => void;
  onOpenSettings?: () => void;
}

export default function Header({
  onToggleSidebar,
  sidebarOpen,
  onToggleTerminal,
  terminalOpen,
  activeView,
  onViewChange,
  onOpenSettings,
}: HeaderProps) {
  const projectName = useProjectStore((s) => s.project.name);
  const resetProject = useProjectStore((s) => s.resetProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const clearChat = useChatStore((s) => s.clearChat);
  const closeTab = useEditorStore((s) => s.closeTab);
  const aiConfig = useAIProviderStore((s) => s.config);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewProject = useCallback(() => {
    resetProject();
    clearChat();
  }, [resetProject, clearChat]);

  const handleLoadTemplate = useCallback(
    (template: ProjectTemplate) => {
      resetProject(template.name);
      clearChat();
      loadProject(template.files);
      setProjectName(template.name);
      setShowTemplates(false);
    },
    [resetProject, clearChat, loadProject, setProjectName]
  );

  const handleExport = useCallback(() => {
    const files = useProjectStore.getState().project.files;
    const json = JSON.stringify(
      { name: projectName, files: Object.fromEntries(Object.entries(files).map(([path, file]) => [path, file.content])) },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}.omni.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectName]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const data = JSON.parse(text);

          // Support both { files: {} } and direct { "src/App.tsx": "code" } format
          let projectFiles: Record<string, string>;
          let name: string | undefined;

          if (data.files && typeof data.files === 'object') {
            projectFiles = data.files;
            name = data.name;
          } else {
            // Direct file map format
            projectFiles = data;
          }

          resetProject(name ?? file.name.replace(/\.\w+$/, ''));
          clearChat();
          loadProject(projectFiles);
          if (name) setProjectName(name);
        } catch {
          alert('Invalid project file. Please select a valid .omni.json file.');
        }
      };
      reader.readAsText(file);
      // Reset input so same file can be imported again
      e.target.value = '';
    },
    [resetProject, clearChat, loadProject, setProjectName]
  );

  const currentProvider = AI_PROVIDERS.find((p) => p.id === aiConfig.provider);
  const isConfigured = aiConfig.apiKey.length > 0;

  return (
    <>
      <header className="h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-2 sm:px-3 select-none">
        {/* Left section */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Logo */}
          <button
            onClick={onToggleSidebar}
            className="flex items-center gap-1.5 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Zap size={12} className="text-white" />
            </div>
            {!sidebarOpen && (
              <span className="text-xs font-bold text-zinc-200 hidden md:inline">
                Omni-Builder
              </span>
            )}
          </button>

          {/* Project name dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-white transition rounded-md hover:bg-zinc-800"
            >
              <span className="font-medium text-zinc-200 hidden sm:inline max-w-[120px] truncate">
                {projectName}
              </span>
              <ChevronDown size={12} />
            </button>

            {showTemplates && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTemplates(false)} />
                <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 py-2 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Templates
                  </div>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleLoadTemplate(t)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                        <FileCode size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200">{t.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{t.description}</p>
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-zinc-800 mt-1 pt-1">
                    <button
                      onClick={() => { handleNewProject(); setShowTemplates(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                        <RotateCcw size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-200">New Project</p>
                        <p className="text-[10px] text-zinc-500">Start from scratch</p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center — View toggle + Provider badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            <button
              onClick={() => onViewChange('chat')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                activeView === 'chat' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Terminal size={12} />
              <span className="hidden sm:inline">Chat</span>
            </button>
            <button
              onClick={() => onViewChange('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition ${
                activeView === 'preview' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Eye size={12} />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </div>

          {/* Provider indicator */}
          <button
            onClick={() => setShowSettings(true)}
            className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition ${
              isConfigured
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20'
            }`}
            title="Configure AI Provider"
          >
            <span>{currentProvider?.icon}</span>
            <span className="max-w-[80px] truncate font-mono text-[10px]">
              {aiConfig.model.split('/').pop()}
            </span>
          </button>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={handleImport}
            className="p-2 text-zinc-400 hover:text-white transition rounded-lg hover:bg-zinc-800"
            title="Import project"
          >
            <Upload size={14} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 text-zinc-400 hover:text-white transition rounded-lg hover:bg-zinc-800"
            title="Export project"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2 transition rounded-lg hover:bg-zinc-800 ${
              isConfigured ? 'text-zinc-400 hover:text-white' : 'text-yellow-400 hover:text-yellow-300 animate-pulse'
            }`}
            title="AI Settings"
          >
            <Settings size={14} />
          </button>
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition"
          >
            <Rocket size={12} />
            <span className="hidden sm:inline">Deploy</span>
          </button>
        </div>
      </header>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.omni.json"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Settings Dialog */}
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
