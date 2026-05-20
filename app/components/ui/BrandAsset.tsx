import type { CSSProperties } from 'react';

interface BrandAssetProps {
  src: string;
  title: string;
  className?: string;
  style?: CSSProperties;
}

export function BrandAsset({ src, title, className = '', style }: BrandAssetProps) {
  if (src.endsWith('.html')) {
    return (
      <iframe
        src={src}
        title={title}
        className={`border-0 bg-transparent overflow-hidden pointer-events-none shrink-0 ${className}`.trim()}
        style={{ border: 0, background: 'transparent', pointerEvents: 'none', ...style }}
        scrolling="no"
        loading="eager"
      />
    );
  }

  return <img src={src} alt={title} className={className} style={style} />;
}
