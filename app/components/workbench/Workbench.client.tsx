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

// Re-type TabOption locally for WorkbenchViewType safety
type WorkbenchTabOption = TabOption & { value: WorkbenchViewType };

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const t = useT();

  const tabOptions: WorkbenchTabOption[] = [
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
        showWorkbench ? 'flex-1 min-w-0 h-full overflow-hidden opacity-100' : 'w-0 min-w-0 h-0 overflow-hidden opacity-0 pointer-events-none',
      )}
    >
      <div className="h-full flex flex-col bg-bolt-elements-background-depth-1 overflow-hidden">
        <div className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
          <WorkbenchTabs selected={selectedView} options={tabOptions} setSelected={(v) => setSelectedView(v as WorkbenchViewType)} />
          <div className="ml-auto" />
          {selectedView === 'code' && (
            <PanelHeaderButton
              className="mr-1 text-sm"
              onClick={() => {
                workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
              }}
            >
              <div className="i-ph:terminal" />
              <span className="hidden sm:inline">{t('workbench.toggleTerminal')}</span>
            </PanelHeaderButton>
          )}
          <IconButton
            icon="i-ph:x-circle"
            className="-mr-1"
            size="xl"
            onClick={() => {
              workbenchStore.showWorkbench.set(false);
              mobileViewStore.set('chat');
            }}
          />
        </div>
        <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
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
