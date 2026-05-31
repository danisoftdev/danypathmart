import { useState } from 'react';
import { resolveImageUrl } from '../../lib/currency';

/**
 * Product image with a graceful brand-coloured fallback when the file is
 * missing (placeholder paths are used until real uploads land).
 */
export default function ProductImage({ src, alt, className = '' }) {
  const [errored, setErrored] = useState(false);
  const url = resolveImageUrl(src);

  if (!url || errored) {
    return (
      <div className={`flex items-center justify-center bg-brand-green/10 ${className}`}>
        <span className="text-2xl font-extrabold tracking-wider text-brand-green/40">DPM</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
