import { memo, useMemo } from 'react';
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
