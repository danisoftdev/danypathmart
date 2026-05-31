import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from '../icons';
import { useDebounce } from '../../hooks/useDebounce';
import { useAutocomplete } from '../../hooks/catalog';
import AutocompleteDropdown from './AutocompleteDropdown';
import ImageSearchButton from './ImageSearchButton';

export default function SearchBar({ onNavigate }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const imageBtnRef = useRef(null);

  const debounced = useDebounce(query, 300);
  const { data, isFetching } = useAutocomplete(debounced);

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];
  const suggestions = data?.suggestions ?? [];
  const total = products.length + categories.length + suggestions.length;

  const showDropdown = open && query.trim().length >= 2;

  // Close on outside click.
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
    onNavigate?.();
  };

  const goSearch = (term) => {
    const q = (term ?? query).trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    close();
  };

  const selectProduct = (p) => {
    navigate(`/product/${p.slug}`);
    close();
  };
  const selectCategory = (c) => {
    navigate(`/shop?category=${encodeURIComponent(c.slug)}`);
    close();
  };
  const selectSuggestion = (s) => {
    setQuery(s);
    goSearch(s);
  };

  const selectIndex = (idx) => {
    if (idx < products.length) return selectProduct(products[idx]);
    if (idx < products.length + categories.length) {
      return selectCategory(categories[idx - products.length]);
    }
    return selectSuggestion(suggestions[idx - products.length - categories.length]);
  };

  const openImagePicker = () => imageBtnRef.current?.open();

  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === 'Enter') goSearch();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < total) selectIndex(activeIndex);
      else goSearch();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={(e) => { e.preventDefault(); goSearch(); }} className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search uniforms, badges, books..."
          className="w-full rounded-xl border-2 border-brand-green bg-white py-2.5 pl-4 pr-24 text-[#111111] outline-none placeholder-muted dark:bg-[#1C1C1C] dark:text-white"
        />
        <ImageSearchButton
          ref={imageBtnRef}
          onClose={close}
          buttonClassName="absolute right-12 flex h-9 w-9 items-center justify-center rounded-lg text-brand-green transition hover:bg-brand-green/10"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-1 flex h-9 w-10 items-center justify-center rounded-lg bg-brand-green text-white transition hover:bg-opacity-90"
        >
          <SearchIcon />
        </button>
      </form>

      {showDropdown && (
        <AutocompleteDropdown
          loading={isFetching && total === 0}
          products={products}
          categories={categories}
          suggestions={suggestions}
          activeIndex={activeIndex}
          onHoverIndex={setActiveIndex}
          onSelectProduct={selectProduct}
          onSelectCategory={selectCategory}
          onSelectSuggestion={selectSuggestion}
          onImageSearch={openImagePicker}
        />
      )}
    </div>
  );
}
