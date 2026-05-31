import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CameraIcon } from '../components/icons';

export default function ImageSearchPage() {
  const location = useLocation();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(location.state?.previewUrl || null);

  const pick = () => fileRef.current?.click();
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPreview(URL.createObjectURL(file));
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">Search by image</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Upload a photo of a product and we&apos;ll find the closest matches.
      </p>

      <div className="mt-8">
        {preview ? (
          <img
            src={preview}
            alt="Upload preview"
            className="mx-auto max-h-72 rounded-xl border border-black/5 object-contain dark:border-white/10"
          />
        ) : (
          <button
            type="button"
            onClick={pick}
            className="mx-auto flex h-56 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-brand-green/50 text-brand-green transition hover:bg-brand-green/5"
          >
            <CameraIcon className="h-10 w-10" />
            <span className="font-medium">Tap to upload an image</span>
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <div className="mt-6 flex items-center justify-center gap-3">
        <button type="button" onClick={pick} className="btn-ghost">
          {preview ? 'Choose another' : 'Upload image'}
        </button>
        <button type="button" disabled className="btn-primary opacity-60" title="Available on Day 3">
          Search by Image
        </button>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Image recognition is being wired up on Day 3. For now you can preview your upload.
      </p>

      <Link to="/shop" className="mt-8 inline-block text-sm font-medium text-brand-green">
        Back to shop
      </Link>
    </div>
  );
}
