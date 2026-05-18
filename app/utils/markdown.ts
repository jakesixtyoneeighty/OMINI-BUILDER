import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import type { PluggableList, Plugin } from 'unified';
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from 'rehype-sanitize';
import { SKIP, visit } from 'unist-util-visit';
import type { UnistNode, UnistParent } from 'node_modules/unist-util-visit/lib';

export const allowedHTMLElements = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'env_request',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'source',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
  'var',
  'db_request',
  'field',
  'user_question',
  'option',
  // Visual HTML elements for omni-visual rendering
  'caption',
  'colgroup',
  'col',
  'figure',
  'figcaption',
  'abbr',
  'progress',
  'meter',
  // Media elements for image, video, audio rendering
  'img',
  'video',
  'audio',
  'source',
  'track',
];

// Allowed CSS properties for style attributes in omni-visual blocks
// Only safe visual properties - no positioning, animations, or interactive CSS
const ALLOWED_CSS_PROPERTIES = new Set([
  // Colors & backgrounds
  'color',
  'background-color',
  'background',
  'opacity',
  // Typography
  'font-weight',
  'font-size',
  'font-style',
  'text-align',
  'text-decoration',
  'text-transform',
  'line-height',
  'letter-spacing',
  'white-space',
  'word-break',
  // Borders
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'border-collapse',
  // Spacing
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'gap',
  // Sizing (for bar charts, progress bars, etc.)
  'width',
  'min-width',
  'max-width',
  'height',
  'min-height',
  'max-height',
  // Display & layout
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-self',
  'flex',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  // Overflow
  'overflow',
  'overflow-x',
  'overflow-y',
  // Visual effects
  'box-shadow',
  // List
  'list-style',
  'list-style-type',
  // Table
  'vertical-align',
  'empty-cells',
  // Misc safe
  'cursor',
  'transition',
  'pointer-events',
]);

/**
 * Rehype plugin that sanitizes `style` attributes on all elements.
 * Only allows safe CSS properties from the ALLOWED_CSS_PROPERTIES set.
 * Strips any dangerous CSS (position, z-index, animations, transforms, etc.)
 */
const rehypeSanitizeStyles: Plugin = () => {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.properties && typeof node.properties.style === 'string') {
        const rawStyle = node.properties.style as string;
        const safeDeclarations: string[] = [];

        // Parse style declarations
        const declarations = rawStyle.split(';');
        for (const decl of declarations) {
          const trimmed = decl.trim();
          if (!trimmed) continue;

          const colonIndex = trimmed.indexOf(':');
          if (colonIndex === -1) continue;

          const prop = trimmed.slice(0, colonIndex).trim().toLowerCase();
          const value = trimmed.slice(colonIndex + 1).trim();

          // Check if property is in the allowed list
          if (ALLOWED_CSS_PROPERTIES.has(prop)) {
            // Additional safety: block dangerous values
            const lowerValue = value.toLowerCase();

            // Block url() in background (no external resources)
            if ((prop === 'background' || prop === 'background-color') && lowerValue.includes('url(')) {
              continue;
            }

            // Block expression() (IE CSS expressions)
            if (lowerValue.includes('expression(')) {
              continue;
            }

            // Block javascript: in any value
            if (lowerValue.includes('javascript:')) {
              continue;
            }

            // For position, only allow relative/static
            if (prop === 'position' && !['relative', 'static'].includes(lowerValue)) {
              continue;
            }

            // Block z-index values that are too high (could overlay UI)
            // Actually z-index isn't in allowed list so it won't pass

            safeDeclarations.push(`${prop}: ${value}`);
          }
        }

        if (safeDeclarations.length > 0) {
          node.properties.style = safeDeclarations.join('; ');
        } else {
          delete node.properties.style;
        }
      }
    });
  };
};

const rehypeSanitizeOptions: RehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: allowedHTMLElements,
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      'data*',
      'style',
      ['className', '__boltArtifact__'],
      ['className', 'omni-visual'],
      ['className', 'omni-bar'],
      ['className', 'omni-bar-fill'],
      ['className', 'omni-card'],
      ['className', 'omni-badge'],
      ['className', 'omni-progress'],
      ['className', 'omni-row'],
      ['className', 'omni-stat'],
      ['className', 'omni-chart'],
      ['className', 'omni-chart-bar'],
      ['className', 'omni-chart-label'],
      ['className', 'omni-chart-value'],
    ],
    span: [...(defaultSchema.attributes?.span ?? []), 'style', ['className', 'omni-badge']],
    table: [...(defaultSchema.attributes?.table ?? []), 'style'],
    th: [...(defaultSchema.attributes?.th ?? []), 'style', 'colspan', 'rowspan'],
    td: [...(defaultSchema.attributes?.td ?? []), 'style', 'colspan', 'rowspan'],
    tr: [...(defaultSchema.attributes?.tr ?? []), 'style'],
    thead: [...(defaultSchema.attributes?.thead ?? []), 'style'],
    tbody: [...(defaultSchema.attributes?.tbody ?? []), 'style'],
    tfoot: [...(defaultSchema.attributes?.tfoot ?? []), 'style'],
    p: [...(defaultSchema.attributes?.p ?? []), 'style'],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'style'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'style'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'style'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'style'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'style'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'style'],
    progress: ['value', 'max', 'style'],
    meter: ['value', 'min', 'max', 'low', 'high', 'optimum', 'style'],
    figure: [...(defaultSchema.attributes?.figure ?? []), 'style'],
    figcaption: [...(defaultSchema.attributes?.figcaption ?? []), 'style'],
    caption: [...(defaultSchema.attributes?.caption ?? []), 'style'],
    col: ['span', 'style'],
    colgroup: ['span', 'style'],
    mark: ['style'],
    abbr: ['title'],
    // Media element attributes
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'style'],
    video: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'width', 'height', 'poster', 'style'],
    audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'style'],
    source: ['src', 'type', 'media'],
    track: ['kind', 'src', 'srclang', 'label', 'default'],
  },
  strip: [],
};

export function remarkPlugins(limitedMarkdown: boolean) {
  const plugins: PluggableList = [remarkGfm];

  if (limitedMarkdown) {
    plugins.unshift(limitedMarkdownPlugin);
  }

  return plugins;
}

export function rehypePlugins(html: boolean) {
  const plugins: PluggableList = [];

  if (html) {
    plugins.push(rehypeRaw, [rehypeSanitize, rehypeSanitizeOptions], rehypeSanitizeStyles);
  }

  return plugins;
}

const limitedMarkdownPlugin: Plugin = () => {
  return (tree, file) => {
    const contents = file.toString();

    visit(tree, (node: UnistNode, index, parent: UnistParent) => {
      if (
        index == null ||
        ['paragraph', 'text', 'inlineCode', 'code', 'strong', 'emphasis'].includes(node.type) ||
        !node.position
      ) {
        return true;
      }

      let value = contents.slice(node.position.start.offset, node.position.end.offset);

      if (node.type === 'heading') {
        value = `\n${value}`;
      }

      parent.children[index] = {
        type: 'text',
        value,
      } as any;

      return [SKIP, index] as const;
    });
  };
};
