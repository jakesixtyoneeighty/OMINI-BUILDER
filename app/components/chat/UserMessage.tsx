import type { Message } from 'ai';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { modificationsRegex } from '~/utils/diff';
import { Markdown } from './Markdown';
import { useT } from '~/lib/i18n/useT';

interface UserMessageProps {
  message: Message;
}

/**
 * Media Lightbox — full-screen overlay to view media at full resolution.
 * Supports images and videos.
 */
function MediaLightbox({
  src,
  alt,
  type,
  onClose,
}: {
  src: string;
  alt: string;
  type: 'image' | 'video';
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all z-10"
      >
        <div className="i-ph:x text-xl" />
      </button>

      {/* Media content */}
      {type === 'image' ? (
        <img
          src={src}
          alt={alt}
          className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <video
          src={src}
          controls
          autoPlay
          className="max-w-[92vw] max-h-[92vh] rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <track kind="captions" />
        </video>
      )}
    </div>,
    document.body,
  );
}

export function UserMessage({ message }: UserMessageProps) {
  const t = useT();
  const attachments = message.experimental_attachments || [];

  // Categorize attachments by media type
  const imageAttachments = attachments.filter((a) => a.contentType?.startsWith('image/'));
  const videoAttachments = attachments.filter((a) => a.contentType?.startsWith('video/'));
  const audioAttachments = attachments.filter((a) => a.contentType?.startsWith('audio/'));
  const inspectorAttachments = attachments.filter(
    (a) => a.contentType === 'application/json' && a.name && !a.name.includes('.'),
  );

  // Regular files = everything that's not image, video, audio, or inspector
  const regularFiles = attachments.filter(
    (a) =>
      !a.contentType?.startsWith('image/') &&
      !a.contentType?.startsWith('video/') &&
      !a.contentType?.startsWith('audio/') &&
      !inspectorAttachments.includes(a),
  );

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');
  const [lightboxType, setLightboxType] = useState<'image' | 'video'>('image');

  const openLightbox = useCallback((src: string, alt: string, type: 'image' | 'video') => {
    setLightboxSrc(src);
    setLightboxAlt(alt);
    setLightboxType(type);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
    setLightboxAlt('');
  }, []);

  return (
    <div className="overflow-hidden pt-[4px]">
      {/* Image attachments — prominent thumbnails with lightbox */}
      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {imageAttachments.map((attachment, i) => (
            <div
              key={`img-${i}`}
              className="relative group rounded-xl overflow-hidden border border-bolt-elements-borderColor cursor-zoom-in hover:border-bolt-elements-borderColorActive transition-all max-w-[280px]"
              onClick={() => openLightbox(attachment.url, attachment.name || `Image ${i + 1}`, 'image')}
            >
              <img
                src={attachment.url}
                alt={attachment.name || t('userMessage.image', { n: i + 1 })}
                className="w-full max-h-[200px] object-cover rounded-xl transition-transform group-hover:scale-[1.02]"
              />
              {/* Hover overlay with expand icon */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                <div className="i-ph:magnifying-glass-plus text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Filename tooltip */}
              {attachment.name && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-white font-medium truncate block">{attachment.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video attachments — inline video player */}
      {videoAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {videoAttachments.map((attachment, i) => (
            <div
              key={`vid-${i}`}
              className="relative rounded-xl overflow-hidden border border-bolt-elements-borderColor max-w-[400px]"
            >
              <video
                src={attachment.url}
                controls
                preload="metadata"
                className="w-full rounded-xl"
                onClick={(e) => {
                  // If user clicks on video, open lightbox for full-screen playback
                  e.stopPropagation();
                  openLightbox(attachment.url, attachment.name || `Video ${i + 1}`, 'video');
                }}
              >
                <track kind="captions" />
                Your browser does not support the video element.
              </video>
              {/* Video badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm pointer-events-none">
                <div className="i-ph:video-camera text-[10px] text-blue-300" />
                <span className="text-[9px] font-medium text-white">Video</span>
              </div>
              {/* Filename */}
              {attachment.name && (
                <div className="px-2 py-1 bg-bolt-elements-bg-depth-2 border-t border-bolt-elements-borderColor">
                  <span className="text-[10px] text-bolt-elements-textTertiary truncate block">{attachment.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Audio attachments — inline audio player */}
      {audioAttachments.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {audioAttachments.map((attachment, i) => (
            <div
              key={`aud-${i}`}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 max-w-[400px]"
            >
              {/* Audio icon */}
              <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
                <div className="i-ph:music-note text-base text-purple-400" />
              </div>
              {/* Audio player */}
              <div className="flex-1 min-w-0">
                {attachment.name && (
                  <span className="text-[11px] font-medium text-bolt-elements-textPrimary truncate block mb-1">
                    {attachment.name}
                  </span>
                )}
                <audio
                  src={attachment.url}
                  controls
                  preload="metadata"
                  className="w-full h-8"
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <MediaLightbox src={lightboxSrc} alt={lightboxAlt} type={lightboxType} onClose={closeLightbox} />
      )}

      {/* Inspector element chips */}
      {inspectorAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {inspectorAttachments.map((attachment, i) => (
            <div
              key={`inspector-${i}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20"
            >
              <div className="i-ph:code text-xs text-orange-400 shrink-0" />
              <code className="text-[11px] text-orange-400 font-mono truncate max-w-[120px]">{attachment.name}</code>
            </div>
          ))}
        </div>
      )}

      {/* File attachment chips */}
      {regularFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {regularFiles.map((attachment, i) => {
            const isCode =
              attachment.contentType?.includes('json') ||
              attachment.contentType?.includes('javascript') ||
              attachment.contentType?.includes('typescript') ||
              attachment.contentType?.includes('text');
            return (
              <div
                key={`file-${i}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20"
              >
                <div
                  className={
                    isCode ? 'i-ph:file-js text-xs text-blue-400 shrink-0' : 'i-ph:file text-xs text-blue-400 shrink-0'
                  }
                />
                <span className="text-[11px] text-blue-400 font-medium truncate max-w-[140px]">
                  {attachment.name || t('userMessage.file', { n: i + 1 })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Message text */}
      <Markdown limitedMarkdown>{sanitizeUserMessage(message.content)}</Markdown>
    </div>
  );
}

function sanitizeUserMessage(content: string) {
  return content.replace(modificationsRegex, '').trim();
}
