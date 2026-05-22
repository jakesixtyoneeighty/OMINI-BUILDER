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
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
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
            <Panel ref={fileTreePanelRef} defaultSize={20} minSize={10} collapsible>
              <div
                className="flex flex-col h-full"
                style={{ borderRight: '1px solid rgba(255,255,255,.06)', background: 'rgba(10,10,18,.6)' }}
              >
                {/* File tree header */}
                <div
                  className="flex items-center justify-between px-3 py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,.25)' }}>
                    <div className="i-ph:tree-structure-duotone text-sm" style={{ color: 'rgba(255,255,255,.3)' }} />
                    {t('editorPanel.files')}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      icon="i-ph:plus"
                      size="sm"
                      title="New File"
                      onClick={() => {/* TODO */}}
                    />
                    <IconButton
                      icon="i-ph:folder-plus"
                      size="sm"
                      title="New Folder"
                      onClick={() => {/* TODO */}}
                    />
                  </div>
                </div>
                <FileTree
                  className="h-full"
                  files={files}
                  hideRoot
                  unsavedFiles={unsavedFiles}
                  rootFolder={WORK_DIR}
                  selectedFile={selectedFile}
                  onFileSelect={onFileSelect}
                />
              </div>
            </Panel>

            {/* Custom resize handle with hover effect */}
            <PanelResizeHandle className="w-[3px] bg-transparent hover:bg-bolt-elements-item-contentAccent/30 transition-colors data-[resize-handle-active]:bg-bolt-elements-item-contentAccent/50" />

            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              {/* Editor header */}
              <div
                className="flex items-center px-3 py-2 gap-2"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  background: 'rgba(10,10,18,.8)',
                }}
              >
                {/* Toggle file tree button */}
                <button
                  onClick={toggleFileTree}
                  className={classNames(
                    'flex items-center justify-center w-7 h-7 rounded-lg transition-all',
                    showFileTree
                      ? 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'
                      : 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent/10',
                  )}
                  title={showFileTree ? 'Hide file tree' : 'Show file tree'}
                >
                  <div className={showFileTree ? 'i-ph:sidebar-simple' : 'i-ph:sidebar-simple-duotone'} text-sm />
                </button>

                <div className="w-px h-4 bg-bolt-elements-borderColor" />

                {/* Breadcrumb */}
                {activeFileSegments?.length ? (
                  <div className="flex items-center flex-1 text-sm min-w-0 overflow-hidden">
                    <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                  </div>
                ) : (
                  <span className="text-xs text-bolt-elements-textTertiary flex-1">
                    Select a file to start editing
                  </span>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {activeFileUnsaved && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1"
                      >
                        <PanelHeaderButton onClick={onFileSave} className="text-emerald-400 hover:text-emerald-300">
                          <div className="i-ph:floppy-disk-duotone" />
                          <span className="hidden sm:inline text-xs">{t('common.save')}</span>
                        </PanelHeaderButton>
                        <PanelHeaderButton onClick={onFileReset}>
                          <div className="i-ph:clock-counter-clockwise-duotone" />
                          <span className="hidden sm:inline text-xs">{t('editorPanel.reset')}</span>
                        </PanelHeaderButton>
                      </motion.div>
                      <div className="w-px h-4 bg-bolt-elements-borderColor mx-1" />
                    </>
                  )}
                  <PanelHeaderButton
                    onClick={() => {
                      workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                    }}
                    className={showTerminal ? 'text-bolt-elements-item-contentAccent' : ''}
                  >
                    <div className="i-ph:terminal" />
                    <span className="hidden sm:inline text-xs">{t('workbench.terminal')}</span>
                  </PanelHeaderButton>
                </div>
              </div>

              {/* Code editor */}
              <div className="h-full flex-1 overflow-hidden bg-bolt-elements-code-background">
                <CodeMirrorEditor
                  theme={theme}
                  editable={!isStreaming && editorDocument !== undefined}
                  settings={editorSettings}
                  doc={editorDocument}
                  autoFocusOnDocumentChange={!isMobile()}
                  onScroll={onEditorScroll}
                  onChange={onEditorChange}
                  onSave={onFileSave}
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Terminal panel */}
        <PanelResizeHandle className="h-[3px] bg-transparent hover:bg-bolt-elements-item-contentAccent/30 transition-colors data-[resize-handle-active]:bg-bolt-elements-item-contentAccent/50" />

        <Panel
          ref={terminalPanelRef}
          defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
          minSize={10}
          collapsible
          onExpand={() => {
            if (!terminalToggledByShortcut.current) {
              workbenchStore.toggleTerminal(true);
            }
          }}
          onCollapse={() => {
            if (!terminalToggledByShortcut.current) {
              workbenchStore.toggleTerminal(false);
            }
          }}
        >
          <div className="h-full">
            <div className="bg-bolt-elements-terminals-background h-full flex flex-col">
              {/* Terminal tabs */}
              <div
                className="flex items-center gap-1 min-h-[36px] px-2"
                style={{
                  background: 'rgba(10,10,18,.9)',
                  borderTop: '1px solid rgba(255,255,255,.05)',
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                }}
              >
                {Array.from({ length: terminalCount }, (_, index) => {
                  const isActive = activeTerminal === index;

                  return (
                    <button
                      key={index}
                      className="flex items-center text-sm cursor-pointer gap-1.5 px-3 py-1.5 h-full whitespace-nowrap rounded-lg transition-all duration-150"
                      style={{
                        background: isActive ? 'rgba(99,102,241,.12)' : 'transparent',
                        color: isActive ? '#a5b4fc' : 'rgba(255,255,255,.3)',
                        border: isActive ? '1px solid rgba(99,102,241,.2)' : '1px solid transparent',
                      }}
                      onClick={() => setActiveTerminal(index)}
                    >
                      <div className={isActive ? 'i-ph:terminal-window-fill' : 'i-ph:terminal-window-duotone'} text-base />
                      <span className="text-xs font-medium">
                        {t('workbench.terminal')} {terminalCount > 1 && index + 1}
                      </span>
                    </button>
                  );
                })}
                {terminalCount < MAX_TERMINALS && (
                  <IconButton icon="i-ph:plus" size="sm" onClick={addTerminal} title="Add terminal" />
                )}
                <div className="ml-auto flex items-center gap-0.5">
                  <IconButton
                    icon="i-ph:caret-down"
                    title={t('common.close')}
                    size="sm"
                    onClick={() => workbenchStore.toggleTerminal(false)}
                  />
                </div>
              </div>

              {/* Terminal content */}
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
