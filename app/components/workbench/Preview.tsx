import { useStore } from '@nanostores/react';
import { memo, useRef, useState, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { projectsStore, activeProjectIdStore } from '~/lib/stores/project';
import { SandpackPreview } from './SandpackPreview';

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[activeId];
  const previewMode = project?.settings?.previewMode || 'webcontainer';

  const refresh = useCallback(() => {
    if (previewMode === 'webcontainer' && iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, [previewMode]);

  const toggleFullscreen = () => {
    const el = document.querySelector('[data-preview-content]');
    if (el) el.requestFullscreen();
  };

  // Sandpack mode - inline preview
  if (previewMode === 'sandpack') {
    return (
      <div className="w-full h-full flex flex-col absolute inset-0 bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium">
            <div className="i-ph:browser-duotone text-sm" />
            Sandpack
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textTertiary truncate">
            Inline Preview
          </div>
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
        </div>
        <div className="flex-1 relative overflow-hidden" data-preview-content>
          <SandpackPreview />
        </div>
      </div>
    );
  }

  // WebContainer mode (default)
  return (
    <div className="w-full h-full flex flex-col absolute inset-0 bg-bolt-elements-background-depth-1">
      <div className="bg-bolt-elements-background-depth-2 px-3 py-1.5 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
        <IconButton icon="i-ph:arrow-clockwise" onClick={refresh} title="Refresh" />
        <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
        <div className="flex-1 flex items-center bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-1 text-xs text-bolt-elements-textSecondary truncate">
          {activePreview?.baseUrl || 'No preview available'}
        </div>
        {previews.length > 0 && (
          <PortDropdown
            activePreviewIndex={activePreviewIndex}
            setActivePreviewIndex={setActivePreviewIndex}
            isDropdownOpen={isPortDropdownOpen}
            setIsDropdownOpen={setIsPortDropdownOpen}
            setHasSelectedPreview={() => {}}
            previews={previews}
          />
        )}
      </div>
      <div className="flex-1 relative overflow-hidden" data-preview-content>
        {activePreview ? (
          <iframe ref={iframeRef} className="w-full h-full bg-white border-0" src={activePreview.baseUrl} />
        ) : (
          <div className="flex items-center justify-center h-full text-bolt-elements-textTertiary">
            <div className="text-center">
              <div className="i-ph:globe-simple text-3xl mb-2 mx-auto" />
              <p className="text-sm">No preview available</p>
              <p className="text-xs text-bolt-elements-textTertiary mt-1">Start a chat to generate a preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
