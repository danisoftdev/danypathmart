import { useRef, useState } from 'react';
import { useUploadHeroImage } from '../../hooks/storefront';
import { resolveImageUrl } from '../../lib/currency';

export default function HeroImageUploadField({ value, onChange }) {
  const upload = useUploadHeroImage();
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
      const msg = err.response?.data?.message || 'Could not upload image.';
      setError(msg);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Hero image</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="hero-visual-card relative flex w-full max-w-[180px] shrink-0 items-center justify-center border-2 border-dashed border-black/15 dark:border-white/25"
        >
          {preview ? (
            <img src={preview} alt="" className="hero-visual-img max-w-[160px]" />
          ) : (
            <span className="px-3 text-center text-xs font-semibold text-muted">
              {upload.isPending ? 'Uploading…' : '+ Upload image'}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            className="input-field"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/uploads/hero/…"
          />
          {value && (
            <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-brand-red">
              Remove image
            </button>
          )}
          <p className="text-xs text-muted">
            Minimum <strong>480×480px</strong> (800×800px or larger recommended). PNG with transparent background is best for logos.
            Images appear with rounded corners on the homepage hero.
          </p>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}
