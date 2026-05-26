import { useStore } from '@nanostores/react';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { useT } from '~/lib/i18n/useT';
import { projectsStore, activeProjectIdStore } from '~/lib/stores/project';
import { mobileViewStore } from '~/lib/stores/layout';
import { classNames } from '~/utils/classNames';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import { DatabasePanel } from './DatabasePanel';
import { WorkbenchTabs, type TabOption } from './WorkbenchTabs';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const t = useT();

  const tabOptions: TabOption<WorkbenchViewType>[] = [
    { value: 'preview', icon: 'i-ph:eye', label: t('workbench.preview') },
    { value: 'code', icon: 'i-ph:code', label: t('workbench.code') },
    { value: 'database', icon: 'i-ph:database', label: t('workbench.database') },
  ];

  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const previewMode = projects[activeId]?.settings?.previewMode || 'webcontainer';

  const setSelectedView = (view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  };

  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview]);

  // Sync files to editor documents only when files actually change content (not just reference)
  const prevFilesContentRef = useRef('');
  useEffect(() => {
    const currentContent = JSON.stringify(
      Object.entries(files)
        .filter(([, f]) => f?.type === 'file')
        .map(([path, f]) => [path, (f as any).content])
        .sort(([a], [b]) => a.localeCompare(b))
    );
    if (currentContent !== prevFilesContentRef.current) {
      prevFilesContentRef.current = currentContent;
      workbenchStore.setDocuments(files);
    }
  }, [files]);

  // Auto-save files to Supabase when files change (debounced, cloud only)
  // Track content changes, not just key changes, to avoid unnecessary saves
  const prevFilesRef = useRef('');
  const isInitialLoad = useRef(true);
  useEffect(() => {
    // Skip auto-save during initial project load to prevent race conditions
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      const currentFileKeys = JSON.stringify(Object.keys(files).sort());
      prevFilesRef.current = currentFileKeys;
      return;
    }

    const currentFileKeys = JSON.stringify(Object.keys(files).sort());
    if (currentFileKeys !== prevFilesRef.current && currentFileKeys.length > 2) {
      prevFilesRef.current = currentFileKeys;
      const timeout = setTimeout(() => {
        // Cloud save only (no localStorage cache)
        workbenchStore.saveEntireProject().catch(() => {});
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [files]);

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const onFileSave = useCallback(() => {
    workbenchStore.saveCurrentDocument().catch(() => {
      toast.error(t('workbench.failedUpdateFile'));
    });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  if (!chatStarted) return null;

  return (
    <div
      className={classNames(
        'transition-all duration-300 ease-in-out',
        showWorkbench ? 'flex-1 min-w-0 h-full opacity-100' : 'w-0 min-w-0 h-0 opacity-0 overflow-hidden pointer-events-none',
      )}
    >
      <div className="h-full flex flex-col bg-bolt-elements-bg-depth-1 border-l border-bolt-elements-borderColor overflow-hidden">
        {/* Modern Minimal Toolbar */}
        <div className="flex items-center px-3 py-1.5 bg-bolt-elements-bg-depth-1 border-b border-bolt-elements-borderColor min-h-[44px]">
          <WorkbenchTabs selected={selectedView} options={tabOptions} setSelected={setSelectedView} />
          
          <div className="ml-auto flex items-center gap-1.5">
            {selectedView === 'code' && (
              <button
                className={classNames(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                  workbenchStore.showTerminal.get() 
                    ? "bg-bolt-elements-item-backgroundAccent/10 text-bolt-elements-item-contentAccent"
                    : "text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive/30"
                )}
                onClick={() => {
                  workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                }}
              >
                <div className="i-ph:terminal-window text-sm" />
                <span className="hidden md:inline">{t('workbench.toggleTerminal')}</span>
              </button>
            )}
            
            <div className="w-px h-3.5 bg-bolt-elements-borderColor/30 mx-1" />
            
            <button
              className="flex items-center justify-center w-7 h-7 rounded-md text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/30 transition-all duration-200"
              onClick={() => {
                workbenchStore.showWorkbench.set(false);
                mobileViewStore.set('chat');
              }}
              title={t('workbench.close')}
            >
              <div className="i-ph:x text-sm" />
            </button>
          </div>
        </div>
        
        <div className="relative flex-1 overflow-hidden">
          <View visible={selectedView === 'preview'}>
            <Preview key={previewMode} />
          </View>
          <View visible={selectedView === 'code'}>
            <EditorPanel
              editorDocument={currentDocument}
              isStreaming={isStreaming}
              selectedFile={selectedFile}
              files={files}
              unsavedFiles={unsavedFiles}
              onFileSelect={onFileSelect}
              onEditorScroll={onEditorScroll}
              onEditorChange={onEditorChange}
              onFileSave={onFileSave}
              onFileReset={onFileReset}
            />
          </View>
          <View visible={selectedView === 'database'}>
            <DatabasePanel />
          </View>
        </div>
      </div>
    </div>
  );
});

interface ViewProps {
  children: JSX.Element;
  visible: boolean;
}

const View = memo(({ children, visible }: ViewProps) => {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-200"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: visible ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
});
