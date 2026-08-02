import { useRef, useState } from 'react';
import { useUploadCategoryImage } from '../../hooks/admin';
import { resolveImageUrl } from '../../lib/currency';

/**
 * Circular category image upload (matches home “Shop by category” avatars).
 */
export default function CategoryImageUploadField({ value, onChange, hint }) {
  const upload = useUploadCategoryImage();
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const preview = resolveImageUrl(value);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const { url } = await upload.mutateAsync(file);
      onChange(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload image.');
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Category image</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-black/15 bg-black/[0.02] transition hover:border-brand-green dark:border-white/20 dark:bg-white/5"
          aria-label={preview ? 'Change category image' : 'Upload category image'}
        >
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[10px] font-semibold leading-tight text-muted">
              {upload.isPending ? '…' : '+ Photo'}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            className="input-field"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/uploads/categories/…"
          />
          {value && (
            <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-brand-red">
              Remove image
            </button>
          )}
          <p className="text-xs text-muted">
            {hint
              || 'Shown on the home category strip. Square JPEG, PNG or WebP up to 5MB. Letter fallback if empty.'}
          </p>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}
