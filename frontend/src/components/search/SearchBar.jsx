import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from '../icons';
import { useDebounce } from '../../hooks/useDebounce';
import { useAutocomplete, useCategories } from '../../hooks/catalog';
import { usePlatformFeatures } from '../../hooks/checkout';
import AutocompleteDropdown, { SearchExplorePanel } from './AutocompleteDropdown';
import ImageSearchButton from './ImageSearchButton';
import {
  addRecentSearch,
  clearRecentSearches,
  DEFAULT_POPULAR_SEARCHES,
  getRecentSearches,
} from '../../lib/browseStorage';

function flatten(nodes = []) {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

const SIZE_CLASS = {
  md: 'py-2.5 pl-11 pr-[7.5rem] text-base',
  lg: 'py-3 pl-12 pr-[8.5rem] text-base md:text-[15px]',
};

const SIZE_CLASS_NO_IMAGE = {
  md: 'py-2.5 pl-11 pr-[4.75rem] text-base',
  lg: 'py-3 pl-12 pr-[5.5rem] text-base md:text-[15px]',
};

export default function SearchBar({ onNavigate, size = 'md', autoFocus = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState([]);
  const containerRef = useRef(null);
  const imageBtnRef = useRef(null);
  const inputRef = useRef(null);

  const debounced = useDebounce(query, 300);
  const { data, isFetching } = useAutocomplete(debounced);
  const { data: catData } = useCategories();
  const { imageSearchAvailable } = usePlatformFeatures();
  const allCategories = flatten(catData?.data ?? []);

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];
  const suggestions = data?.suggestions ?? [];
  const total = products.length + categories.length + suggestions.length;
  const trimmed = query.trim();
  const showExplore = open && trimmed.length < 2;
  const showAutocomplete = open && trimmed.length >= 2;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const refreshRecent = () => setRecentSearches(getRecentSearches());

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
    addRecentSearch(q);
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
    if (!showAutocomplete) {
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goSearch();
        }}
        className="relative flex items-center"
      >
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-green/70" aria-hidden>
          <SearchIcon className="h-5 w-5" />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => {
            refreshRecent();
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search uniforms, badges, books..."
          aria-label="Search products"
          aria-expanded={open}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          className={`w-full rounded-full border border-black/12 bg-[#F3F4F6] font-medium text-[#111111] shadow-inner outline-none transition placeholder:text-[#6B7280] focus:border-brand-green focus:bg-white focus:ring-2 focus:ring-brand-green/25 dark:border-white/15 dark:bg-[#2A2A2A] dark:text-white dark:focus:bg-[#1E1E1E] ${imageSearchAvailable ? SIZE_CLASS[size] : SIZE_CLASS_NO_IMAGE[size]}`}
        />
        {imageSearchAvailable && (
          <ImageSearchButton
            ref={imageBtnRef}
            onClose={close}
            buttonClassName="absolute right-[4.75rem] flex h-9 w-9 items-center justify-center rounded-full text-brand-green transition hover:bg-black/5 dark:hover:bg-white/10"
          />
        )}
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-1 top-1/2 flex h-9 -translate-y-1/2 items-center gap-1.5 rounded-full bg-brand-green px-3.5 text-sm font-bold text-white transition hover:bg-opacity-90 sm:px-4"
        >
          <SearchIcon className="h-4 w-4 md:hidden" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      {showExplore && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2">
          <SearchExplorePanel
            recentSearches={recentSearches}
            popularSearches={DEFAULT_POPULAR_SEARCHES}
            categories={allCategories}
            onSelectSearch={goSearch}
            onClearRecent={() => {
              clearRecentSearches();
              setRecentSearches([]);
            }}
            onSelectCategory={selectCategory}
            onImageSearch={imageSearchAvailable ? openImagePicker : undefined}
            showImageSearch={imageSearchAvailable}
          />
        </div>
      )}

      {showAutocomplete && (
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
          onImageSearch={imageSearchAvailable ? openImagePicker : undefined}
          showImageSearch={imageSearchAvailable}
        />
      )}
    </div>
  );
}
