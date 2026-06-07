import { useState } from 'react';
import { PRODUCT_FALLBACK_IMAGE, resolveProductImageUrl } from '../../lib/productImages';

/**
 * Product image — uses the company logo when no photo is set or the file fails to load.
 */
export default function ProductImage({ src, alt, className = '', fit = 'cover', priority = false }) {
  const [errored, setErrored] = useState(false);
  const url = resolveProductImageUrl(src);
  const showFallback = !url || errored;
  const objectClass = fit === 'contain' ? 'object-contain' : 'object-cover';

  if (showFallback) {
    return (
      <div className={`flex items-center justify-center bg-brand-green/5 ${className}`}>
        <img
          src={PRODUCT_FALLBACK_IMAGE}
          alt={alt || 'DanyPathMart'}
          className="h-[55%] w-[55%] max-h-24 max-w-24 object-contain opacity-90"
        />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      onError={() => setErrored(true)}
      className={`${objectClass} ${className}`}
    />
  );
}
