import type { CSSProperties } from 'react';

/** Resolve legacy .html logo wrappers to their image asset. */
function resolveBrandSrc(src: string): string {
  if (src === '/omini-logo.html') return '/omni-builder-logo.png';
  if (src === '/omini-favicon.html') return '/omini-favicon.png';
  return src;
}

interface BrandAssetProps {
  src: string;
  title: string;
  className?: string;
  style?: CSSProperties;
}

export function BrandAsset({ src, title, className = '', style }: BrandAssetProps) {
  const resolved = resolveBrandSrc(src);

  if (resolved.endsWith('.html')) {
    return (
      <iframe
        src={resolved}
        title={title}
        className={`border-0 bg-transparent overflow-hidden pointer-events-none shrink-0 ${className}`.trim()}
        style={{ border: 0, background: 'transparent', pointerEvents: 'none', ...style }}
        scrolling="no"
        loading="eager"
      />
    );
  }

  return (
    <img
      src={resolved}
      alt={title}
      className={className}
      style={{ objectFit: 'contain', objectPosition: 'left center', ...style }}
    />
  );
}
