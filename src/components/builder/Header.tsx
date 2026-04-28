// ============================================================
// Omni-Builder — Header Component
// ============================================================
'use client';

import { useState, useCallback } from 'react';
import { useProjectStore, useChatStore, useDeployStore } from '@/store';
import { TEMPLATES } from '@/services/templates';
import type { ProjectTemplate } from '@/types';
import {
  Rocket,
  Download,
  RotateCcw,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Zap,
  Eye,
  Terminal,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onToggleTerminal: () => void;
  terminalOpen: boolean;
  activeView: 'chat' | 'preview';
  onViewChange: (view: 'chat' | 'preview') => void;
}

export default function Header({
  onToggleSidebar,
  sidebarOpen,
  onToggleTerminal,
  terminalOpen,
  activeView,
  onViewChange,
}: HeaderProps) {
  const projectName = useProjectStore((s) => s.project.name);
  const resetProject = useProjectStore((s) => s.resetProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const clearChat = useChatStore((s) => s.clearChat);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);

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
      Object.fromEntries(
        Object.entries(files).map(([path, file]) => [path, file.content])
      ),
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectName]);

  return (
    <header className="h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-3 select-none">
      {/* Left section */}
      <div className="flex items-center gap-2">
        {/* Logo */}
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          {!sidebarOpen && (
            <span className="text-xs font-bold text-zinc-200 hidden sm:inline">
              Omni-Builder
            </span>
          )}
        </button>

        {/* Project name */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white transition rounded-md hover:bg-zinc-800"
          >
            <span className="font-medium text-zinc-200">{projectName}</span>
            <ChevronDown size={12} />
          </button>

          {/* Template dropdown */}
          {showTemplates && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowTemplates(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 py-2 overflow-hidden">
                <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Templates
                </div>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleLoadTemplate(t)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                      <FileCode size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{t.name}</p>
                      <p className="text-[10px] text-zinc-500">{t.description}</p>
                    </div>
                  </button>
                ))}
                <div className="border-t border-zinc-800 mt-1 pt-1">
                  <button
                    onClick={handleNewProject}
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

      {/* Center section — View toggle */}
      <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
        <button
          onClick={() => onViewChange('chat')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition ${
            activeView === 'chat'
              ? 'bg-zinc-700 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Terminal size={12} />
          <span className="hidden sm:inline">Chat</span>
        </button>
        <button
          onClick={() => onViewChange('preview')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition ${
            activeView === 'preview'
              ? 'bg-zinc-700 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Eye size={12} />
          <span className="hidden sm:inline">Preview</span>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleExport}
          className="p-2 text-zinc-400 hover:text-white transition rounded-lg hover:bg-zinc-800"
          title="Export project"
        >
          <Download size={14} />
        </button>

        <button
          onClick={() => setShowDeploy(!showDeploy)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition"
        >
          <Rocket size={12} />
          <span className="hidden sm:inline">Deploy</span>
        </button>
      </div>
    </header>
  );
}

function FileCode({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </svg>
  );
}
