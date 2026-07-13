import { useRef, useState } from 'react';
import { resolveProductImageUrl } from '../../lib/productImages';

/**
 * Product images — upload files and/or paste URLs (max 5).
 * @param {{ urls: string[], onChange: (urls: string[]) => void, uploadFile: (file: File) => Promise<{ url: string }> }} props
 */
export default function ShopProductImagesField({ urls = [], onChange, uploadFile }) {
  const inputRef = useRef(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];

  const pushUrl = (url) => {
    const next = [...list, url].slice(0, 5);
    onChange(next);
  };

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setUploading(true);
    try {
      let current = [...list];
      for (const file of files) {
        if (current.length >= 5) break;
        const { url } = await uploadFile(file);
        current = [...current, url].slice(0, 5);
      }
      onChange(current);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const addUrl = () => {
    const u = urlDraft.trim();
    if (!u) return;
    if (list.length >= 5) {
      setError('Maximum 5 images.');
      return;
    }
    setError('');
    pushUrl(u);
    setUrlDraft('');
  };

  const removeAt = (idx) => onChange(list.filter((_, i) => i !== idx));

  return (
    <div>
      <p className="mb-1 text-sm font-semibold">Images</p>
      <p className="mb-2 text-xs text-muted">Upload files or paste image URLs — choose either. Up to 5 images.</p>

      <div className="flex flex-wrap gap-2">
        {list.map((url, idx) => (
          <div key={`${url}-${idx}`} className="relative h-20 w-20 overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
            <img src={resolveProductImageUrl(url)} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-bold text-white"
              onClick={() => removeAt(idx)}
            >
              ×
            </button>
          </div>
        ))}
        {list.length < 5 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/15 text-[10px] font-semibold text-muted hover:border-brand-green dark:border-white/20"
          >
            {uploading ? '…' : '+ Upload'}
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input-field min-w-0 flex-1 font-mono text-xs"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="Or paste image URL"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addUrl();
            }
          }}
        />
        <button type="button" className="btn-ghost shrink-0 px-3 text-sm" onClick={addUrl} disabled={!urlDraft.trim() || list.length >= 5}>
          Add URL
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
