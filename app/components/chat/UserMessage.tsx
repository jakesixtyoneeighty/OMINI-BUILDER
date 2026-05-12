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
 * Image Lightbox — full-screen overlay to view an image at full resolution.
 */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-10"
      >
        <div className="i-ph:x text-xl" />
      </button>

      {/* Full image */}
      <img
        src={src}
        alt={alt}
        className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

export function UserMessage({ message }: UserMessageProps) {
  const t = useT();
  const attachments = message.experimental_attachments || [];
  const imageAttachments = attachments.filter((a) => a.contentType?.startsWith('image/'));
  const fileAttachments = attachments.filter((a) => !a.contentType?.startsWith('image/'));
  const inspectorAttachments = attachments.filter(
    (a) => a.contentType === 'application/json' && a.name && !a.name.includes('.'),
  );

  // Separate inspector elements from regular files
  const regularFiles = fileAttachments.filter((a) => !inspectorAttachments.includes(a));

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');

  const openLightbox = useCallback((src: string, alt: string) => {
    setLightboxSrc(src);
    setLightboxAlt(alt);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
    setLightboxAlt('');
  }, []);

  return (
    <div className="overflow-hidden pt-[4px]">
      {/* Image attachments — compact thumbnails */}
      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {imageAttachments.map((attachment, i) => (
            <div
              key={`img-${i}`}
              className="relative group rounded-lg overflow-hidden border border-bolt-elements-borderColor cursor-zoom-in hover:border-bolt-elements-borderColorActive transition-all"
              onClick={() => openLightbox(attachment.url, attachment.name || `Image ${i + 1}`)}
            >
              <img
                src={attachment.url}
                alt={attachment.name || t('userMessage.image', { n: i + 1 })}
                className="w-16 h-16 object-cover rounded-lg transition-transform group-hover:scale-105"
              />
              {/* Hover overlay with expand icon */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                <div className="i-ph:magnifying-glass-plus text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Filename tooltip */}
              {attachment.name && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[8px] text-white font-medium truncate block">{attachment.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={closeLightbox} />
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
