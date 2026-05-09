import type { Message } from 'ai';
import { modificationsRegex } from '~/utils/diff';
import { Markdown } from './Markdown';
import { useT } from '~/lib/i18n/useT';

interface UserMessageProps {
  message: Message;
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

  return (
    <div className="overflow-hidden pt-[4px]">
      {/* Image attachments grid */}
      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {imageAttachments.map((attachment, i) => (
            <div
              key={`img-${i}`}
              className="relative group rounded-xl overflow-hidden border border-bolt-elements-borderColor max-w-[280px]"
            >
              <img
                src={attachment.url}
                alt={attachment.name || t('userMessage.image', { n: i + 1 })}
                className="w-full h-auto max-h-[200px] object-cover rounded-xl"
              />
              {attachment.name && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1">
                  <span className="text-[10px] text-white font-medium truncate block">{attachment.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
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
