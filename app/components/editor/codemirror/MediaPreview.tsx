import { useState, useEffect, useRef } from 'react';
import { webcontainer } from '~/lib/webcontainer';

/**
 * Detects the media type of a file based on its extension.
 */
function getMediaType(filePath: string): 'image' | 'video' | 'audio' | 'unknown' {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  const imageExtensions = ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'tiff', 'tif'];
  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'];

  if (imageExtensions.includes(ext)) return 'image';
  if (videoExtensions.includes(ext)) return 'video';
  if (audioExtensions.includes(ext)) return 'audio';
  return 'unknown';
}

/**
 * Gets the MIME type for a file based on its extension.
 */
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    // Images
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    avif: 'image/avif',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    m4v: 'video/mp4',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    wma: 'audio/x-ms-wma',
    opus: 'audio/opus',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

interface MediaPreviewProps {
  filePath: string;
  /** Text content for text-based previewable files (like SVG) */
  textContent?: string;
}

export function MediaPreview({ filePath, textContent }: MediaPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const prevPathRef = useRef<string>();

  const mediaType = getMediaType(filePath);
  const mimeType = getMimeType(filePath);
  const fileName = filePath.split('/').pop() || filePath;
  const isSVG = filePath.split('.').pop()?.toLowerCase() === 'svg';

  useEffect(() => {
    // Skip if path hasn't changed (unless textContent changed for SVG)
    if (prevPathRef.current === filePath && !textContent) return;
    prevPathRef.current = filePath;

    let revoked = false;
    let currentBlobUrl: string | undefined;

    async function loadFile() {
      setLoading(true);
      setError(undefined);

      // If we have text content (e.g., SVG code), create a data URL directly
      if (textContent) {
        try {
          if (isSVG) {
            // For SVGs, use a data URL with the raw text — more reliable than base64 for SVG
            const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(textContent)}`;
            if (!revoked) {
              setBlobUrl(dataUrl);
              setLoading(false);
            }
            return;
          }
          // For other text-based images, encode to bytes and create blob
          const encoder = new TextEncoder();
          const bytes = encoder.encode(textContent);
          const blob = new Blob([bytes], { type: mimeType });
          const url = URL.createObjectURL(blob);
          currentBlobUrl = url;
          if (!revoked) {
            setBlobUrl(url);
            setLoading(false);
          }
          return;
        } catch (e) {
          console.warn('[MediaPreview] Failed to create preview from text content:', e);
          // Fall through to WebContainer read
        }
      }

      // Read binary files from WebContainer
      try {
        const wc = await webcontainer;
        const relativePath = filePath.replace(/^\/home\/project\//, '');
        const content = await wc.fs.readFile(relativePath);

        let uint8: Uint8Array;
        if (content instanceof Uint8Array) {
          uint8 = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
        } else {
          // Text content — encode to bytes
          const encoder = new TextEncoder();
          uint8 = encoder.encode(content as string);
        }

        const blob = new Blob([uint8.buffer as ArrayBuffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        currentBlobUrl = url;

        if (!revoked) {
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[MediaPreview] Failed to read file from WebContainer:', err);
        if (!revoked) {
          setError(err?.message || 'Failed to load file');
          setLoading(false);
        }
      }
    }

    loadFile();

    return () => {
      revoked = true;
      if (currentBlobUrl && !currentBlobUrl.startsWith('data:')) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [filePath, textContent, mimeType, isSVG]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (blobUrl && !blobUrl.startsWith('data:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Unknown media type — show fallback message
  if (mediaType === 'unknown') {
    return (
      <div className="flex items-center justify-center absolute inset-0 z-10 text-sm bg-tk-elements-app-backgroundColor text-tk-elements-app-textColor">
        <div className="flex flex-col items-center gap-3">
          <div className="i-ph:file text-4xl text-bolt-elements-textTertiary" />
          <p>File format cannot be displayed.</p>
          <p className="text-xs text-bolt-elements-textTertiary">{fileName}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center absolute inset-0 z-10 text-sm bg-tk-elements-app-backgroundColor text-tk-elements-app-textColor">
        <div className="flex flex-col items-center gap-3">
          <div className="i-ph:spinner-gap text-4xl animate-spin text-bolt-elements-item-contentAccent" />
          <p>Loading preview...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center absolute inset-0 z-10 text-sm bg-tk-elements-app-backgroundColor text-tk-elements-app-textColor">
        <div className="flex flex-col items-center gap-3">
          <div className="i-ph:warning text-4xl text-orange-400" />
          <p>Failed to load preview</p>
          <p className="text-xs text-bolt-elements-textTertiary">{error}</p>
        </div>
      </div>
    );
  }

  // Image preview
  if (mediaType === 'image' && blobUrl) {
    return (
      <div className="flex items-center justify-center absolute inset-0 z-10 bg-tk-elements-app-backgroundColor overflow-auto">
        <div className="flex flex-col items-center gap-2 p-4 max-w-full max-h-full">
          <img
            src={blobUrl}
            alt={fileName}
            className="max-w-full max-h-[calc(100%-2rem)] object-contain rounded shadow-lg"
          />
          <p className="text-xs text-bolt-elements-textTertiary">{fileName}</p>
        </div>
      </div>
    );
  }

  // Video preview
  if (mediaType === 'video' && blobUrl) {
    return (
      <div className="flex items-center justify-center absolute inset-0 z-10 bg-tk-elements-app-backgroundColor overflow-auto">
        <div className="flex flex-col items-center gap-2 p-4 max-w-full max-h-full w-full">
          <video
            src={blobUrl}
            controls
            className="max-w-full max-h-[calc(100%-2rem)] rounded shadow-lg"
            style={{ minHeight: '200px' }}
          >
            Your browser does not support the video element.
          </video>
          <p className="text-xs text-bolt-elements-textTertiary">{fileName}</p>
        </div>
      </div>
    );
  }

  // Audio preview
  if (mediaType === 'audio' && blobUrl) {
    return (
      <div className="flex items-center justify-center absolute inset-0 z-10 bg-tk-elements-app-backgroundColor">
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="i-ph:music-note text-6xl text-bolt-elements-item-contentAccent" />
          <p className="text-sm text-bolt-elements-textPrimary font-medium">{fileName}</p>
          <audio src={blobUrl} controls className="w-80">
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center absolute inset-0 z-10 text-sm bg-tk-elements-app-backgroundColor text-tk-elements-app-textColor">
      File format cannot be displayed.
    </div>
  );
}
