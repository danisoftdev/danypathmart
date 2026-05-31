import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraIcon, CloseIcon } from '../icons';
import api from '../../lib/api';
import { useImageSearchStore } from '../../store/imageSearchStore';

/**
 * Camera button + hidden file input. On selection it shows a small preview with
 * a "Search by Image" action, uploads the file to /api/search/image, stores the
 * result and routes to /search?type=image. Parent can call ref.open().
 */
const ImageSearchButton = forwardRef(function ImageSearchButton({ buttonClassName = '', onClose }, ref) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const setResult = useImageSearchStore((s) => s.setResult);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    open: () => inputRef.current?.click(),
  }));

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError('');
  };

  const onSelect = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setError('');
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/search/image', fd, {
        headers: { 'Content-Type': undefined },
      });
      setResult({ ...data, previewUrl: preview });
      reset();
      onClose?.();
      navigate('/search?type=image');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not analyse that image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Search by image"
        title="Search by image"
        className={buttonClassName}
      >
        <CameraIcon />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onSelect}
        className="hidden"
      />

      {(preview || loading) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-black/10 bg-white p-3 shadow-xl dark:border-white/15 dark:bg-[#1c1c1c]">
          {loading ? (
            <div className="flex items-center gap-3 py-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
              <span className="text-sm font-medium text-brand-green">
                Analysing image
                <span className="ml-0.5 inline-flex">
                  <span className="animate-bounce [animation-delay:-0.3s]">.</span>
                  <span className="animate-bounce [animation-delay:-0.15s]">.</span>
                  <span className="animate-bounce">.</span>
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img
                src={preview}
                alt="Selected"
                className="h-[50px] w-[50px] flex-shrink-0 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={submit}
                className="flex-1 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90"
              >
                Search by Image
              </button>
              <button
                type="button"
                onClick={reset}
                aria-label="Cancel image search"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </>
  );
});

export default ImageSearchButton;
