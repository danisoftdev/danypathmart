import { useState } from 'react';
import { CameraIcon, SearchIcon } from '../icons';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * Search bar skeleton. The autocomplete dropdown and image-search flow are
 * wired up on Day 2 / Day 3 - this provides the input, camera, and submit UI.
 */
export default function SearchBar() {
  const [query, setQuery] = useState('');
  // Reserved for Day 2 autocomplete (debounced API calls).
  useDebounce(query, 300);

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="relative flex w-full items-center"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search uniforms, badges, books..."
        className="w-full rounded-xl border-2 border-brand-green bg-white py-2.5 pl-4 pr-24 text-black outline-none placeholder:text-gray-400 dark:bg-[#1c1c1c] dark:text-white"
      />
      <button
        type="button"
        aria-label="Search by image"
        title="Search by image"
        className="absolute right-12 flex h-9 w-9 items-center justify-center rounded-lg text-brand-green transition hover:bg-brand-green/10"
      >
        <CameraIcon />
      </button>
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-1 flex h-9 w-10 items-center justify-center rounded-lg bg-brand-green text-white transition hover:bg-opacity-90"
      >
        <SearchIcon />
      </button>
    </form>
  );
}
