import { useEffect } from 'react';
import { CloseIcon } from '../icons';
import SearchBar from '../search/SearchBar';
import { useSearchOverlay } from '../../hooks/useSearchOverlay';

export default function SearchOverlay() {
  const { open, closeSearch } = useSearchOverlay();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') closeSearch();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeSearch]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#FFF9F3] dark:bg-[#121212] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="flex items-center gap-3 border-b border-black/8 px-4 py-3 dark:border-white/10">
        <div className="flex-1">
          <SearchBar size="lg" autoFocus onNavigate={closeSearch} />
        </div>
        <button
          type="button"
          onClick={closeSearch}
          aria-label="Close search"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm text-muted">
          Search groceries and marketplace products — or use image search from the camera icon.
        </p>
      </div>
    </div>
  );
}
