import { useStore } from '@nanostores/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { shortcutEventEmitter } from '~/lib/hooks';
import { useT } from '~/lib/i18n/useT';
import type { FileMap } from '~/lib/stores/files';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile, useIsMobile } from '~/utils/mobile';
import { motion } from 'framer-motion';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { Terminal, type TerminalRef } from './terminal/Terminal';
import { PistonTerminal } from './PistonTerminal';
import { projectsStore, activeProjectIdStore } from '~/lib/stores/project';

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const MAX_TERMINALS = 3;
const DEFAULT_TERMINAL_SIZE = 25;
const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

/**
 * Lazy terminal wrapper
 */
function LazyTerminal({
  isActive,
  terminalIndex,
  onTerminalReady,
  onTerminalResize,
  theme,
  terminalRefs,
}: {
  isActive: boolean;
  terminalIndex: number;
  onTerminalReady: (terminal: any) => void;
  onTerminalResize: (cols: number, rows: number) => void;
  theme: string;
  terminalRefs: React.MutableRefObject<Array<TerminalRef | null>>;
}) {
  const [hasBeenActive, setHasBeenActive] = useState(isActive);

  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);

  const t = useT();

  if (!hasBeenActive) {
    return (
      <div className="h-full flex items-center justify-center text-bolt-elements-textTertiary text-xs">
        {t('editorPanel.clickToActivateTerminal')}
      </div>
    );
  }

  return (
    <Terminal
      id={terminalIndex}
      className={classNames('h-full overflow-hidden', {
        hidden: !isActive,
      })}
      ref={(ref) => {
        terminalRefs.current[terminalIndex] = ref;
      }}
      onTerminalReady={onTerminalReady}
      onTerminalResize={onTerminalResize}
      theme={theme as any}
    />
  );
}

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const t = useT();
    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);
    const activeId = useStore(activeProjectIdStore);
    const projects = useStore(projectsStore);
    const previewMode = projects[activeId]?.settings?.previewMode || 'webcontainer';
    const isPistonMode = previewMode === 'piston';
    const _mobile = useIsMobile();

    const fileTreePanelRef = useRef<ImperativePanelHandle>(null);
    const terminalRefs = useRef<Array<TerminalRef | null>>([]);
    const terminalPanelRef = useRef<ImperativePanelHandle>(null);
    const terminalToggledByShortcut = useRef(false);

    const [activeTerminal, setActiveTerminal] = useState(0);
    const [terminalCount, setTerminalCount] = useState(1);
    const [showFileTree, setShowFileTree] = useState(true);

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      return editorDocument !== undefined && unsavedFiles?.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    useEffect(() => {
      if (_mobile && fileTreePanelRef.current) {
        fileTreePanelRef.current.collapse();
        setShowFileTree(false);
      }
    }, [_mobile]);

    useEffect(() => {
      const unsubscribeFromEventEmitter = shortcutEventEmitter.on('toggleTerminal', () => {
        terminalToggledByShortcut.current = true;
      });

      const unsubscribeFromThemeStore = themeStore.subscribe(() => {
        for (const ref of Object.values(terminalRefs.current)) {
          ref?.reloadStyles();
        }
      });

      return () => {
        unsubscribeFromEventEmitter();
        unsubscribeFromThemeStore();
      };
    }, []);

    useEffect(() => {
      const { current: terminal } = terminalPanelRef;

      if (!terminal) {
        return;
      }

      const isCollapsed = terminal.isCollapsed();

      if (!showTerminal && !isCollapsed) {
        terminal.collapse();
      } else if (showTerminal && isCollapsed) {
        terminal.resize(DEFAULT_TERMINAL_SIZE);
      }

      terminalToggledByShortcut.current = false;
    }, [showTerminal]);

    const addTerminal = () => {
      if (terminalCount < MAX_TERMINALS) {
        setTerminalCount(terminalCount + 1);
        setActiveTerminal(terminalCount);
      }
    };

    const toggleFileTree = () => {
      const panel = fileTreePanelRef.current;
      if (panel) {
        if (panel.isCollapsed()) {
          panel.expand();
          setShowFileTree(true);
        } else {
          panel.collapse();
          setShowFileTree(false);
        }
      }
    };

    return (
      <PanelGroup direction="vertical" className="h-full">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal" className="h-full">

            {/* ── Sidebar: File Tree ── */}
            <Panel ref={fileTreePanelRef} defaultSize={20} minSize={10} collapsible>
              <div className="flex flex-col h-full bg-bolt-elements-bg-depth-2 border-r border-bolt-elements-borderColor/30">
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-4 h-12 shrink-0 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor/30">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:files-duotone text-lg text-bolt-elements-item-contentAccent" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-bolt-elements-textSecondary">
                      Explorer
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 rounded-md text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-colors"
                      title="New File"
                    >
                      <div className="i-ph:file-plus text-sm" />
                    </button>
                    <button
                      className="p-1 rounded-md text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-colors"
                      title="Refresh"
                    >
                      <div className="i-ph:arrow-counter-clockwise text-sm" />
                    </button>
                  </div>
                </div>
                
                {/* File tree container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <FileTree
                    className="file-tree-container px-2 py-3"
                    files={files}
                    hideRoot
                    unsavedFiles={unsavedFiles}
                    rootFolder={WORK_DIR}
                    selectedFile={selectedFile}
                    onFileSelect={onFileSelect}
                  />
                </div>
              </div>
            </Panel>

            {/* Custom Divider */}
            <PanelResizeHandle className="w-[1px] bg-bolt-elements-borderColor/20 hover:bg-bolt-elements-item-contentAccent/40 transition-colors duration-300" />

            {/* ── Editor Panel ── */}
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>

              {/* Editor header bar (Tab style) */}
              <div className="flex items-center h-12 shrink-0 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor/30 overflow-x-auto no-scrollbar">
                
                {/* Sidebar toggle */}
                {!showFileTree && (
                  <button
                    onClick={toggleFileTree}
                    className="flex items-center justify-center w-12 h-12 border-r border-bolt-elements-borderColor/20 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
                  >
                    <div className="i-ph:sidebar-simple text-lg" />
                  </button>
                )}

                {/* Active Tab */}
                {editorDocument && (
                  <div className="flex items-center h-full px-4 border-r border-bolt-elements-borderColor/30 bg-bolt-elements-bg-depth-2 min-w-[120px] max-w-[240px]">
                    <div className="i-ph:file-code-duotone mr-2.5 text-bolt-elements-item-contentAccent text-lg" />
                    <span className="text-xs font-medium text-bolt-elements-textPrimary truncate mr-2">
                      {editorDocument.filePath.split('/').pop()}
                    </span>
                    {activeFileUnsaved && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>
                )}

                {/* Breadcrumbs (Minimalist) */}
                <div className="flex-1 px-4 flex items-center overflow-hidden">
                  <div className="h-4 w-[1px] bg-bolt-elements-borderColor/30 mr-4 hidden sm:block" />
                  {activeFileSegments?.length ? (
                    <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                  ) : null}
                </div>

                {/* Editor Actions */}
                <div className="flex items-center px-4 gap-2">
                  {activeFileUnsaved && (
                    <motion.button
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={onFileSave}
                      className="flex items-center gap-2 px-4 h-8 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider transition-all"
                    >
                      <div className="i-ph:check-circle-duotone text-sm" />
                      {t('common.save')}
                    </motion.button>
                  )}

                  <div className="h-6 w-[1px] bg-bolt-elements-borderColor/20 mx-1" />

                  <button
                    onClick={() => workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get())}
                    className={classNames(
                      'flex items-center justify-center w-8 h-8 rounded-lg transition-all',
                      showTerminal 
                        ? 'bg-bolt-elements-item-backgroundAccent/20 text-bolt-elements-item-contentAccent shadow-sm ring-1 ring-bolt-elements-item-contentAccent/30'
                        : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50'
                    )}
                    title="Toggle Terminal"
                  >
                    <div className="i-ph:terminal-window text-lg" />
                  </button>
                </div>
              </div>

              {/* Code editor body */}
              <div className="flex-1 overflow-hidden relative">
                {editorDocument ? (
                  <CodeMirrorEditor
                    theme={theme}
                    editable={!isStreaming}
                    settings={editorSettings}
                    doc={editorDocument}
                    autoFocusOnDocumentChange={!isMobile()}
                    onScroll={onEditorScroll}
                    onChange={onEditorChange}
                    onSave={onFileSave}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-bolt-elements-bg-depth-1/50 backdrop-blur-sm select-none">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-6"
                    >
                      <div className="w-24 h-24 rounded-3xl bg-bolt-elements-bg-depth-2 flex items-center justify-center shadow-xl border border-bolt-elements-borderColor/20 ring-4 ring-bolt-elements-borderColor/5">
                        <div className="i-bolt:logo text-6xl text-bolt-elements-item-contentAccent/40" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-bold text-bolt-elements-textPrimary">Select a file</h3>
                        <p className="text-sm text-bolt-elements-textTertiary max-w-[240px]">
                          Choose a file from the explorer to start building your application
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor/20 text-[11px] text-bolt-elements-textTertiary">
                          <kbd className="bg-bolt-elements-bg-depth-3 px-1.5 py-0.5 rounded border border-bolt-elements-borderColor/30 font-sans">⌘</kbd>
                          <kbd className="bg-bolt-elements-bg-depth-3 px-1.5 py-0.5 rounded border border-bolt-elements-borderColor/30 font-sans">P</kbd>
                          <span>Quick Open</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Resize handle between editor and terminal */}
        <PanelResizeHandle className="h-px bg-bolt-elements-borderColor hover:bg-bolt-elements-item-contentAccent/40 transition-colors duration-150 data-[resize-handle-active]:bg-bolt-elements-item-contentAccent/60" />

        {/* ── Terminal Panel ── */}
        <Panel
          ref={terminalPanelRef}
          defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
          minSize={10}
          collapsible
          onExpand={() => { if (!terminalToggledByShortcut.current) workbenchStore.toggleTerminal(true); }}
          onCollapse={() => { if (!terminalToggledByShortcut.current) workbenchStore.toggleTerminal(false); }}
        >
          <div className="h-full flex flex-col bg-bolt-elements-terminals-background">

            {/* Terminal tab bar */}
            <div className="flex items-center h-12 px-4 gap-2 shrink-0 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor/20">
              {Array.from({ length: terminalCount }, (_, index) => {
                const isActive = activeTerminal === index;
                return (
                  <motion.button
                    key={index}
                    onClick={() => setActiveTerminal(index)}
                    className={classNames(
                      'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                      isActive
                        ? 'bg-bolt-elements-item-backgroundAccent/20 text-bolt-elements-item-contentAccent border border-bolt-elements-item-contentAccent/30'
                        : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/50'
                    )}
                    layoutId={`terminal-tab-${index}`}
                  >
                    <div className={classNames('text-sm', isActive ? 'i-ph:terminal-window-fill' : 'i-ph:terminal-window')} />
                    <span>{t('workbench.terminal')}{terminalCount > 1 ? ` ${index + 1}` : ''}</span>
                  </motion.button>
                );
              })}

              {terminalCount < MAX_TERMINALS && (
                <button
                  onClick={addTerminal}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
                  title="Add terminal"
                >
                  <div className="i-ph:plus text-sm" />
                </button>
              )}

              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => workbenchStore.toggleTerminal(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/50 transition-all"
                  title={t('common.close')}
                >
                  <div className="i-ph:x text-sm" />
                </button>
              </div>
            </div>

            {/* Terminal content */}
            <div className="flex-1 overflow-hidden">
              {isPistonMode ? (
                <PistonTerminal previewMode={previewMode} />
              ) : (
                Array.from({ length: terminalCount }, (_, index) => (
                  <LazyTerminal
                    key={index}
                    isActive={activeTerminal === index}
                    terminalIndex={index}
                    onTerminalReady={(terminal) => workbenchStore.attachTerminal(terminal)}
                    onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                    theme={theme}
                    terminalRefs={terminalRefs}
                  />
                ))
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    );
  },
);
