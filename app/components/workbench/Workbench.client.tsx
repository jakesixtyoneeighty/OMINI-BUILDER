import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { projectsStore, activeProjectIdStore } from '~/lib/stores/project';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

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

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  // Auto-save files to localStorage cache when files change (debounced)
  const prevFilesRef = useRef('');
  useEffect(() => {
    const currentFileKeys = JSON.stringify(Object.keys(files).sort());
    if (currentFileKeys !== prevFilesRef.current && currentFileKeys.length > 2) {
      prevFilesRef.current = currentFileKeys;
      const timeout = setTimeout(() => {
        workbenchStore.filesStore.saveFilesToCache();
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
      toast.error('Failed to update file content');
    });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  if (!chatStarted) return null;

  return (
    <div
      className={classNames(
        'flex-1 min-w-0 h-full transition-all duration-200 overflow-hidden',
        showWorkbench ? 'opacity-100' : 'w-0 opacity-0 pointer-events-none',
      )}
    >
      <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden m-0.5">
        <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
          <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
          <div className="ml-auto" />
          {selectedView === 'code' && (
            <PanelHeaderButton
              className="mr-1 text-sm"
              onClick={() => {
                workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
              }}
            >
              <div className="i-ph:terminal" />
              Toggle Terminal
            </PanelHeaderButton>
          )}
          <IconButton
            icon="i-ph:x-circle"
            className="-mr-1"
            size="xl"
            onClick={() => {
              workbenchStore.showWorkbench.set(false);
            }}
          />
        </div>
        <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <View
            initial={{ x: selectedView === 'code' ? 0 : '-100%' }}
            animate={{ x: selectedView === 'code' ? 0 : '-100%' }}
          >
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
          <View
            initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
            animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
          >
            <Preview key={previewMode} />
          </View>
        </div>
      </div>
    </div>
  );
});

interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
