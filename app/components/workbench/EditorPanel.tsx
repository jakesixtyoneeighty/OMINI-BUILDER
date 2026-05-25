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
      <PanelGroup direction="vertical">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal">

            {/* ── File Tree Panel ── */}
            <Panel ref={fileTreePanelRef} defaultSize={18} minSize={10} collapsible>
              <div className="flex flex-col h-full rounded-3xl overflow-hidden bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor/15 shadow-sm">

                {/* File tree header */}
                <div className="flex items-center justify-between px-3 h-11 shrink-0 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor/20">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:folders-duotone text-base text-bolt-elements-textTertiary" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bolt-elements-textTertiary">
                      Files
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      icon="i-ph:file-plus"
                      size="sm"
                      title="New File"
                      className="rounded-full border border-bolt-elements-borderColor/10 bg-bolt-elements-bg-depth-1 text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive"
                      onClick={() => {/* TODO */}}
                    />
                    <IconButton
                      icon="i-ph:folder-plus"
                      size="sm"
                      title="New Folder"
                      className="rounded-full border border-bolt-elements-borderColor/10 bg-bolt-elements-bg-depth-1 text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive"
                      onClick={() => {/* TODO */}}
                    />
                  </div>
                </div>

                <FileTree
                  className="h-full overflow-y-auto bg-bolt-elements-bg-depth-2"
                  files={files}
                  hideRoot
                  unsavedFiles={unsavedFiles}
                  rootFolder={WORK_DIR}
                  selectedFile={selectedFile}
                  onFileSelect={onFileSelect}
                />
              </div>
            </Panel>

            {/* Resize handle */}
            <PanelResizeHandle className="w-px bg-bolt-elements-borderColor/20 hover:bg-bolt-elements-item-contentAccent/40 transition-colors duration-150 data-[resize-handle-active]:bg-bolt-elements-item-contentAccent/60" />

            {/* ── Editor Panel ── */}
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>

              {/* Editor top bar */}
              <div className="flex items-center h-12 px-3 gap-2 shrink-0 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor/20 shadow-sm">

                {/* Sidebar toggle */}
                <button
                  onClick={toggleFileTree}
                  className="flex items-center justify-center w-9 h-9 rounded-full transition-all text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/80"
                  title={showFileTree ? 'Hide files' : 'Show files'}
                >
                  <div className={classNames('text-sm', showFileTree ? 'i-ph:sidebar-simple' : 'i-ph:sidebar-simple-duotone')} />
                </button>

                {/* Breadcrumb / placeholder */}
                {activeFileSegments?.length ? (
                  <div className="flex items-center flex-1 min-w-0 overflow-hidden rounded-full bg-bolt-elements-bg-depth-2 px-3 py-2">
                    <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                  </div>
                ) : (
                  <span className="text-xs text-bolt-elements-textTertiary flex-1 select-none">
                    No file open
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {activeFileUnsaved && (
                    <motion.div
                      initial={{ opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2"
                    >
                      <button
                        onClick={onFileSave}
                        className="flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold transition-all bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                      >
                        <div className="i-ph:floppy-disk-duotone text-sm" />
                        <span className="hidden sm:inline">{t('common.save')}</span>
                      </button>
                      <button
                        onClick={onFileReset}
                        className="flex items-center justify-center w-9 h-9 rounded-full text-bolt-elements-textTertiary transition-all hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/80"
                        title="Reset changes"
                      >
                        <div className="i-ph:arrow-counter-clockwise text-sm" />
                      </button>
                    </motion.div>
                  )}

                  {/* Terminal toggle */}
                  <button
                    onClick={() => workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get())}
                    className={classNames(
                      'flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold transition-all border',
                      showTerminal
                        ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent/25'
                        : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/80 border-transparent'
                    )}
                  >
                    <div className={classNames('text-sm', showTerminal ? 'i-ph:terminal-window-fill' : 'i-ph:terminal-window')} />
                    <span className="hidden sm:inline">{t('workbench.terminal')}</span>
                  </button>
                </div>
              </div>

              {/* Code editor body */}
              <div className="flex-1 overflow-hidden bg-bolt-elements-code-background">
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
                  <div className="h-full flex flex-col items-center justify-center gap-4 select-none">
                    <div className="i-ph:code-duotone text-5xl text-bolt-elements-textTertiary/30" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-bolt-elements-textTertiary">No file open</p>
                      <p className="text-xs text-bolt-elements-textTertiary/60 mt-1">Select a file from the panel to start editing</p>
                    </div>
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
            <div className="flex items-center h-11 px-3 gap-2 shrink-0 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor/20">
              {Array.from({ length: terminalCount }, (_, index) => {
                const isActive = activeTerminal === index;
                return (
                  <button
                    key={index}
                    onClick={() => setActiveTerminal(index)}
                    className={classNames(
                      'flex items-center gap-1.5 px-3 h-9 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border',
                      isActive
                        ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent/25'
                        : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/80 border-transparent'
                    )}
                  >
                    <div className={classNames('text-xs', isActive ? 'i-ph:terminal-window-fill' : 'i-ph:terminal-window')} />
                    <span>{t('workbench.terminal')}{terminalCount > 1 ? ` ${index + 1}` : ''}</span>
                  </button>
                );
              })}

              {terminalCount < MAX_TERMINALS && (
                <button
                  onClick={addTerminal}
                  className="flex items-center justify-center w-9 h-9 rounded-full text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/80 transition-all"
                  title="Add terminal"
                >
                  <div className="i-ph:plus text-sm" />
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => workbenchStore.toggleTerminal(false)}
                  className="flex items-center justify-center w-9 h-9 rounded-full text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/80 transition-all"
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
