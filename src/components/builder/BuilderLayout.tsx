// ============================================================
// Omni-Builder — BuilderLayout (Main Layout Component)
// ============================================================
'use client';

import { useState, useCallback } from 'react';
import { useEditorStore } from '@/store';
import CodeEditor from './CodeEditor';
import LivePreview from './LivePreview';
import FileExplorer from './FileExplorer';
import ChatPanel from './ChatPanel';
import Header from './Header';
import TerminalPanel from './TerminalPanel';
import DatabaseConfigPanel from './DatabaseConfigPanel';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { X } from 'lucide-react';

export default function BuilderLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'preview' | 'database'>('chat');

  const openTabs = useEditorStore((s) => s.openTabs);
  const activeTab = useEditorStore((s) => s.activeTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setActiveTabAction = useEditorStore((s) => s.setActiveTab);
  const markClean = useEditorStore((s) => s.markClean);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Header */}
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
        terminalOpen={terminalOpen}
        activeView={activeView}
        onViewChange={setActiveView}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer Sidebar */}
        {sidebarOpen && (
          <div className="w-56 shrink-0 border-r border-zinc-800 hidden md:block">
            <FileExplorer />
          </div>
        )}

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ResizablePanelGroup direction="vertical" className="flex-1">
            {/* Top panel: Tabs + Editor/Preview */}
            <ResizablePanel defaultSize={terminalOpen ? 65 : 100} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Editor Tabs */}
                {openTabs.length > 0 && (
                  <div className="flex items-center bg-zinc-950 border-b border-zinc-800 overflow-x-auto">
                    {openTabs.map((tab) => (
                      <div
                        key={tab.id}
                        onClick={() => {
                          setActiveTabAction(tab.path);
                          markClean(tab.path);
                        }}
                        className={`group flex items-center gap-1.5 px-3 py-2 text-xs border-r border-zinc-800 cursor-pointer transition shrink-0 ${
                          activeTab === tab.path
                            ? 'bg-zinc-900 text-zinc-100 border-b-2 border-b-violet-500'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                        }`}
                      >
                        <span className="truncate max-w-[120px]">
                          {tab.path.split('/').pop()}
                        </span>
                        {tab.isDirty && (
                          <span className="w-2 h-2 rounded-full bg-violet-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-700 rounded transition"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Editor + Right panel (Chat/Preview) */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Code Editor */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <CodeEditor />
                  </div>

                  {/* Right panel: Preview, Chat, or Database (desktop only) */}
                  <div className="w-[45%] min-w-[300px] max-w-[600px] border-l border-zinc-800 shrink-0 hidden lg:block">
                    {activeView === 'preview' ? (
                      <LivePreview />
                    ) : activeView === 'database' ? (
                      <DatabaseConfigPanel />
                    ) : (
                      <ChatPanel onOpenSettings={() => setSettingsOpen(true)} />
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>

            {/* Terminal panel */}
            {terminalOpen && (
              <>
                <ResizableHandle withHandle className="bg-zinc-800 hover:bg-zinc-700" />
                <ResizablePanel defaultSize={35} minSize={15}>
                  <TerminalPanel />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Mobile: bottom sheet for Chat/Preview/Database on small screens */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 top-12 z-50 bg-zinc-950 border-t border-zinc-800">
        {activeView === 'preview' ? (
          <LivePreview />
        ) : activeView === 'database' ? (
          <DatabaseConfigPanel />
        ) : (
          <ChatPanel onOpenSettings={() => setSettingsOpen(true)} />
        )}
      </div>
    </div>
  );
}
