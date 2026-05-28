import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
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

const fileIconMap: Record<string, string> = {
  tsx: 'i-ph:file-tsx text-cyan-400',
  ts: 'i-ph:file-ts text-blue-400',
  jsx: 'i-ph:file-jsx text-teal-400',
  js: 'i-ph:file-js text-yellow-400',
  css: 'i-ph:file-css text-blue-400',
  scss: 'i-ph:file-css text-pink-400',
  sass: 'i-ph:file-css text-pink-400',
  html: 'i-ph:file-html text-orange-400',
  json: 'i-ph:brackets-curly-duotone text-amber-500 dark:text-amber-400',
  md: 'i-ph:file-text text-gray-400',
  mdx: 'i-ph:file-text text-gray-400',
  py: 'i-ph:file-python text-yellow-400',
  rs: 'i-ph:file-code text-orange-400',
  go: 'i-ph:file-code text-cyan-400',
  rb: 'i-ph:file-code text-red-400',
  php: 'i-ph:file-php text-purple-400',
  env: 'i-ph:gear text-yellow-400',
  svg: 'i-ph:file-svg text-pink-400',
  png: 'i-ph:image text-purple-400',
  jpg: 'i-ph:image text-purple-400',
  jpeg: 'i-ph:image text-purple-400',
  yaml: 'i-ph:file-dotted text-blue-300',
  yml: 'i-ph:file-dotted text-blue-300',
  toml: 'i-ph:file-dotted text-orange-300',
  sh: 'i-ph:terminal-window text-green-400',
  bash: 'i-ph:terminal-window text-green-400',
  lock: 'i-ph:lock text-gray-500',
};

function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return fileIconMap[ext] || 'i-ph:file-code text-bolt-elements-textTertiary';
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
      if (!editorDocument) return undefined;
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
      if (!terminal) return;

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
              <div className="flex flex-col h-full bg-bolt-elements-bg-depth-2 border-r border-bolt-elements-borderColor">
                <div className="panel-header-modern justify-between">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:files-duotone text-sm text-bolt-elements-item-contentAccent" />
                    <span>Explorer</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button className="p-1 rounded text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all" title="New File">
                      <div className="i-ph:file-plus text-xs" />
                    </button>
                    <button onClick={toggleFileTree} className="p-1 rounded text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50 transition-all" title="Close sidebar">
                      <div className="i-ph:x text-xs" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  <FileTree
                    className="px-1"
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

            {/* Divider */}
            <PanelResizeHandle className="w-[1px] bg-bolt-elements-borderColor/20 hover:bg-bolt-elements-item-contentAccent/30 transition-colors duration-200 relative group" />

            {/* ── Editor Panel ── */}
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>

              {/* Editor tab bar - VS Code / Bolt style */}
              <div className="editor-tab-bar">
                {!showFileTree && (
                  <button
                    onClick={toggleFileTree}
                    className="flex items-center justify-center h-full px-3 border-r border-bolt-elements-borderColor text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/30 transition-all"
                    title="Open sidebar"
                  >
                    <div className="i-ph:sidebar-simple text-sm" />
                  </button>
                )}

                {editorDocument ? (
                  <div className="editor-tab active h-full">
                    <div className={classNames('text-sm shrink-0', getFileIcon(editorDocument.filePath))} />
                    <span className="truncate max-w-[140px]">{editorDocument.filePath.split('/').pop()}</span>
                    {activeFileUnsaved && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.4)] shrink-0" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onFileSave?.(); }}
                      className="tab-close shrink-0"
                      title="Save"
                    >
                      <div className="i-ph:x text-xs" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center h-full px-4 text-xs text-bolt-elements-textTertiary">
                    <div className="i-ph:code text-sm mr-2 opacity-50" />
                    No file selected
                  </div>
                )}

                <div className="flex-1" />

                {/* Editor Actions */}
                <div className="flex items-center h-full px-2 gap-1">
                  {activeFileUnsaved && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onFileSave}
                      className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-[11px] font-semibold transition-all"
                    >
                      <div className="i-ph:check-circle text-xs" />
                      {t('common.save')}
                    </motion.button>
                  )}

                  <div className="h-4 w-[1px] bg-bolt-elements-borderColor/30 mx-1" />

                  <button
                    onClick={() => workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get())}
                    className={classNames(
                      'flex items-center justify-center w-7 h-7 rounded-md transition-all',
                      showTerminal
                        ? 'bg-bolt-elements-item-backgroundAccent/20 text-bolt-elements-item-contentAccent'
                        : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/30'
                    )}
                    title="Toggle Terminal"
                  >
                    <div className="i-ph:terminal-window text-sm" />
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
                  <div className="editor-empty-state absolute inset-0 flex flex-col items-center justify-center bg-bolt-elements-bg-depth-1/30 select-none">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-5"
                    >
                      <div className="w-20 h-20 rounded-2xl bg-bolt-elements-bg-depth-2 flex items-center justify-center border border-bolt-elements-borderColor/30">
                        <div className="i-ph:code-duotone text-4xl text-bolt-elements-item-contentAccent/30" />
                      </div>
                      <div className="text-center space-y-1.5">
                        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Select a file to edit</h3>
                        <p className="text-xs text-bolt-elements-textTertiary max-w-[220px] leading-relaxed">
                          Choose a file from the explorer to start editing your code
                        </p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor/20 text-[11px] text-bolt-elements-textTertiary">
                        <kbd className="bg-bolt-elements-bg-depth-3 px-1.5 py-0.5 rounded border border-bolt-elements-borderColor/30 font-sans">⌘</kbd>
                        <kbd className="bg-bolt-elements-bg-depth-3 px-1.5 py-0.5 rounded border border-bolt-elements-borderColor/30 font-sans">P</kbd>
                        <span className="ml-1">Quick Open</span>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Resize handle editor/terminal */}
        <PanelResizeHandle className="h-px bg-bolt-elements-borderColor hover:bg-bolt-elements-item-contentAccent/30 transition-colors duration-200 relative group">
          <div className="absolute inset-x-0 -top-1 -bottom-1 group-hover:bg-bolt-elements-item-contentAccent/10 transition-colors" />
        </PanelResizeHandle>

        {/* ── Terminal Panel ── */}
        <Panel
          ref={terminalPanelRef}
          defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
          minSize={10}
          collapsible
          onExpand={() => { if (!terminalToggledByShortcut.current) workbenchStore.toggleTerminal(true); }}
          onCollapse={() => { if (!terminalToggledByShortcut.current) workbenchStore.toggleTerminal(false); }}
        >
          <div className="terminal-container">
            <div className="terminal-tab-bar">
              {Array.from({ length: terminalCount }, (_, index) => {
                const isActive = activeTerminal === index;
                return (
                  <button
                    key={index}
                    onClick={() => setActiveTerminal(index)}
                    className={classNames('terminal-tab-item', { active: isActive })}
                  >
                    <div className={classNames('text-xs', isActive ? 'i-ph:terminal-window-fill' : 'i-ph:terminal-window')} />
                    <span>{t('workbench.terminal')}{terminalCount > 1 ? ` ${index + 1}` : ''}</span>
                  </button>
                );
              })}
              {terminalCount < MAX_TERMINALS && (
                <button onClick={addTerminal} className="terminal-tab-item" title="Add terminal">
                  <div className="i-ph:plus text-xs" />
                </button>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => workbenchStore.toggleTerminal(false)} className="terminal-tab-item" title={t('common.close')}>
                  <div className="i-ph:x text-xs" />
                </button>
              </div>
            </div>
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
