import { useRef, useState } from 'react';
import { resolveProductImageUrl } from '../../lib/productImages';

/**
 * Optional shop logo — file upload and/or URL paste.
 * @param {{ value: string, onChange: (url: string) => void, uploadFile: (file: File) => Promise<{ url: string }>, label?: string }} props
 */
export default function ShopLogoField({ value, onChange, uploadFile, label = 'Shop logo (optional)' }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const preview = resolveProductImageUrl(value);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      onChange(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-black/15 bg-black/[0.02] transition hover:border-brand-green dark:border-white/20 dark:bg-white/5"
        >
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[10px] font-semibold text-muted">
              {uploading ? 'Uploading…' : '+ Logo'}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Or paste image URL</span>
            <input
              className="input-field w-full"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://… or /uploads/shops/…"
            />
          </label>
          {value && (
            <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-brand-red">
              Remove logo
            </button>
          )}
          <p className="text-xs text-muted">Square image works best. JPEG, PNG or WebP up to 5MB.</p>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}
