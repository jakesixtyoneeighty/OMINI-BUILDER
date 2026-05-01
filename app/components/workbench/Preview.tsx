import { useStore } from '@nanostores/react';
import { memo, useRef, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { getActiveProject } from '~/lib/stores/project';
import { SandpackPreview } from './SandpackPreview';

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const project = getActiveProject();
  const previewMode = project.settings?.previewMode || 'webcontainer';

  const refresh = () => {
    if (previewMode === 'webcontainer' && iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const toggleFullscreen = () => {
    const el = document.querySelector('[data-preview-content]');
    if (el) el.requestFullscreen();
  };

  // Sandpack mode
  if (previewMode === 'sandpack') {
    return (
      <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
        <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-2 border-b border-bolt-elements-borderColor">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-medium">
            <div className="i-ph:browser-duotone" />
            Sandpack
          </div>
          <div className="flex-1 text-xs text-bolt-elements-textSecondary truncate px-2">
            Sandpack Preview Mode
          </div>
          <IconButton icon="i-ph:arrows-out-simple" onClick={toggleFullscreen} title="Fullscreen" />
        </div>
        <div className="flex-1 overflow-hidden" data-preview-content>
          <SandpackPreview />
        </div>
      </div>
    );
  }

  // WebContainer mode (default)
  return (
    <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
      <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-2 border-b border-bolt-elements-borderColor">
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
      <div className="flex-1 overflow-hidden" data-preview-content>
        {activePreview ? (
          <iframe ref={iframeRef} className="w-full h-full bg-white" src={activePreview.baseUrl} />
        ) : (
          <div className="flex items-center justify-center h-full text-bolt-elements-textTertiary">No preview available</div>
        )}
      </div>
    </div>
  );
});
