import { memo, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { createScopedLogger } from '~/utils/logger';
import { rehypePlugins, remarkPlugins, allowedHTMLElements } from '~/utils/markdown';
import { Artifact } from './Artifact';
import { CodeBlock } from './CodeBlock';

import styles from './Markdown.module.scss';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
}

/**
 * Image lightbox for markdown images — click to view full size.
 */
function MarkdownImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-10"
      >
        <div className="i-ph:x text-xl" />
      </button>
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

/**
 * Markdown image with click-to-zoom lightbox support.
 * Separate component so it can use its own state.
 */
function MarkdownImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { node?: any }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className="max-w-full rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity my-2"
        onClick={() => setLightboxOpen(true)}
        loading="lazy"
        {...props}
      />
      {lightboxOpen && src && (
        <MarkdownImageLightbox
          src={src}
          alt={alt || ''}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

export const Markdown = memo(({ children, html = false, limitedMarkdown = false }: MarkdownProps) => {
  logger.trace('Render');

  const components = useMemo(() => {
    return {
      div: ({ className, children, node, ...props }) => {
        if (className?.includes('__boltArtifact__')) {
          const messageId = node?.properties.dataMessageId as string;

          if (!messageId) {
            logger.error(`Invalid message id ${messageId}`);
          }

          return <Artifact messageId={messageId} />;
        }

        // Render omni-visual blocks with special styling
        if (className?.includes('omni-visual')) {
          return (
            <div className={`${className || ''} ${styles.OmniVisual}`} {...props}>
              {children}
            </div>
          );
        }

        // Render omni- sub-components with styles
        if (className?.includes('omni-bar')) {
          return (
            <div className={`${className || ''} ${styles.OmniBar}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-bar-fill')) {
          return (
            <div className={`${className || ''} ${styles.OmniBarFill}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-card')) {
          return (
            <div className={`${className || ''} ${styles.OmniCard}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-badge')) {
          return (
            <div className={`${className || ''} ${styles.OmniBadge}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-progress')) {
          return (
            <div className={`${className || ''} ${styles.OmniProgressWrapper}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-row')) {
          return (
            <div className={`${className || ''} ${styles.OmniRow}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-stat')) {
          return (
            <div className={`${className || ''} ${styles.OmniStat}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-chart')) {
          return (
            <div className={`${className || ''} ${styles.OmniChart}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-chart-bar')) {
          return (
            <div className={`${className || ''} ${styles.OmniChartBar}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-chart-label')) {
          return (
            <div className={`${className || ''} ${styles.OmniChartLabel}`} {...props}>
              {children}
            </div>
          );
        }

        if (className?.includes('omni-chart-value')) {
          return (
            <div className={`${className || ''} ${styles.OmniChartValue}`} {...props}>
              {children}
            </div>
          );
        }

        return (
          <div className={className} {...props}>
            {children}
          </div>
        );
      },
      span: ({ className, children, ...props }) => {
        if (className?.includes('omni-badge')) {
          return (
            <span className={`${className || ''} ${styles.OmniBadge}`} {...props}>
              {children}
            </span>
          );
        }

        return (
          <span className={className} {...props}>
            {children}
          </span>
        );
      },
      table: ({ children, ...props }) => {
        return (
          <div className={styles.OmniTableWrapper}>
            <table {...props}>{children}</table>
          </div>
        );
      },
      progress: ({ children, ...props }) => {
        return (
          <progress className={styles.OmniProgressNative} {...props}>
            {children}
          </progress>
        );
      },
      pre: (props) => {
        const { children, node, ...rest } = props;

        const [firstChild] = node?.children ?? [];

        if (
          firstChild &&
          firstChild.type === 'element' &&
          firstChild.tagName === 'code' &&
          firstChild.children[0].type === 'text'
        ) {
          const { className, ...rest } = firstChild.properties;
          const [, language = 'plaintext'] = /language-(\w+)/.exec(String(className) || '') ?? [];

          return <CodeBlock code={firstChild.children[0].value} language={language as BundledLanguage} {...rest} />;
        }

        return <pre {...rest}>{children}</pre>;
      },
      img: (props) => {
        return <MarkdownImage {...props} />;
      },
      video: (props) => {
        const { children, ...rest } = props;
        return (
          <div className="my-2 rounded-xl overflow-hidden border border-bolt-elements-borderColor max-w-[500px]">
            <video controls preload="metadata" className="w-full" {...rest}>
              {children}
            </video>
          </div>
        );
      },
      audio: (props) => {
        const { children, ...rest } = props;
        return (
          <div className="my-2 flex items-center gap-3 p-2.5 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 max-w-[400px]">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
              <div className="i-ph:music-note text-sm text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <audio controls preload="metadata" className="w-full h-8" {...rest}>
                {children}
              </audio>
            </div>
          </div>
        );
      },
    } satisfies Components;
  }, []);

  return (
    <ReactMarkdown
      allowedElements={allowedHTMLElements}
      className={styles.MarkdownContent}
      components={components}
      remarkPlugins={remarkPlugins(limitedMarkdown)}
      rehypePlugins={rehypePlugins(html)}
    >
      {children}
    </ReactMarkdown>
  );
});
