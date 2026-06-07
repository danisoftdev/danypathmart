import { useRef, useState } from 'react';
import { useUploadProductImage } from '../../hooks/admin';
import { resolveProductImageUrl } from '../../lib/productImages';

export default function KitCoverImageField({ value, onChange }) {
  const upload = useUploadProductImage();
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const preview = resolveProductImageUrl(value);

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
    <div className="sm:col-span-2">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Cover image (optional)</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="relative flex aspect-[16/9] w-full max-w-xs shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-black/15 bg-black/[0.02] transition hover:border-brand-green dark:border-white/20 dark:bg-white/5"
        >
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-3 text-center text-xs font-semibold text-muted">
              {upload.isPending ? 'Uploading…' : '+ Upload cover photo'}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Or paste image URL</span>
            <input
              className="input-field"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://… or /uploads/products/…"
            />
          </label>
          {value && (
            <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-brand-red">
              Remove cover
            </button>
          )}
          <p className="text-xs text-muted">Shown on the kit landing page and kit list. JPEG, PNG or WebP up to 5MB.</p>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}
