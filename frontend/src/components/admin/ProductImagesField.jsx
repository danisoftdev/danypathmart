import { useRef, useState } from 'react';
import { useUploadProductImage } from '../../hooks/admin';
import ProductImage from '../product/ProductImage';
import { resolveProductImageUrl } from '../../lib/productImages';

const MAX_IMAGES = 5;

export default function ProductImagesField({ images = [], onChange, className = '' }) {
  const upload = useUploadProductImage();
  const inputRef = useRef(null);
  const [slotIndex, setSlotIndex] = useState(null);
  const [error, setError] = useState('');

  const slots = Array.from({ length: MAX_IMAGES }, (_, i) => images[i] || '');

  const pickFile = (index) => {
    setSlotIndex(index);
    setError('');
    inputRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || slotIndex == null) return;

    setError('');
    try {
      const { url } = await upload.mutateAsync(file);
      const next = [...slots];
      next[slotIndex] = url;
      onChange(next.filter(Boolean));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload image.');
    } finally {
      setSlotIndex(null);
    }
  };

  const removeAt = (index) => {
    onChange(slots.filter((_, i) => i !== index).filter(Boolean));
  };

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        Product photos <span className="font-normal normal-case">(optional, up to {MAX_IMAGES})</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {slots.map((src, index) => (
          <div key={index} className="relative">
            <button
              type="button"
              onClick={() => pickFile(index)}
              disabled={upload.isPending && slotIndex === index}
              className="flex h-20 w-20 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-black/15 bg-black/[0.02] text-center transition hover:border-brand-green dark:border-white/20 dark:bg-white/5"
              aria-label={src ? `Change photo ${index + 1}` : `Add photo ${index + 1}`}
            >
              {src ? (
                <img
                  src={resolveProductImageUrl(src)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-1 text-[10px] font-semibold leading-tight text-muted">
                  {upload.isPending && slotIndex === index ? '…' : '+ Photo'}
                </span>
              )}
            </button>
            {src && (
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white shadow"
                aria-label={`Remove photo ${index + 1}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">First photo is the main image on product cards. Products without photos show the company logo.</p>
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}

/** Compact preview row for edit modal header */
export function ProductImagesPreview({ images = [], alt }) {
  if (!images.length) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black/[0.03] dark:bg-white/5">
        <ProductImage src={null} alt={alt} className="h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {images.map((src, i) => (
        <div key={i} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
          <ProductImage src={src} alt={alt} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
