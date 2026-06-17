import { SearchIcon, CameraIcon, ClockIcon } from '../icons';
import ProductImage from '../product/ProductImage';
import { SkeletonBlock } from '../ui/Skeleton';
import { formatPrice } from '../../lib/currency';

function SectionHeader({ children, action }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-3">
      <div className="text-xs font-bold uppercase tracking-wider text-brand-gold">{children}</div>
      {action}
    </div>
  );
}

export function SearchExplorePanel({
  recentSearches = [],
  popularSearches = [],
  categories = [],
  onSelectSearch,
  onClearRecent,
  onSelectCategory,
  onImageSearch,
  showImageSearch = true,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-xl dark:border-white/10 dark:bg-[#1E1E1E]">
      {recentSearches.length > 0 && (
        <div>
          <SectionHeader
            action={
              <button
                type="button"
                onClick={onClearRecent}
                className="text-[11px] font-semibold text-brand-green hover:underline"
              >
                Clear
              </button>
            }
          >
            Recent searches
          </SectionHeader>
          {recentSearches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSelectSearch(s)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-brand-green/10"
            >
              <ClockIcon className="shrink-0 text-subtle" />
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}

      {popularSearches.length > 0 && (
        <div>
          <SectionHeader>Popular searches</SectionHeader>
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {popularSearches.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSearch(s)}
                className="rounded-full border border-brand-green/30 bg-brand-green/5 px-3 py-1.5 text-sm font-medium text-brand-green transition hover:bg-brand-green hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div>
          <SectionHeader>Categories</SectionHeader>
          <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-3">
            {categories.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCategory(c)}
                className="rounded-xl border border-black/8 bg-[#FFF9F3] px-3 py-2.5 text-left text-sm font-semibold transition hover:border-brand-green hover:text-brand-green dark:border-white/10 dark:bg-[#121212]"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showImageSearch && onImageSearch && (
      <button
        type="button"
        onClick={onImageSearch}
        className="flex w-full items-center justify-center gap-2 border-t border-black/5 px-4 py-4 text-sm font-semibold text-brand-green hover:bg-brand-green/5 dark:border-white/10"
      >
        <CameraIcon className="h-5 w-5" />
        Search by image
      </button>
      )}
    </div>
  );
}

export default function AutocompleteDropdown({
  loading,
  products = [],
  categories = [],
  suggestions = [],
  activeIndex,
  onHoverIndex,
  onSelectProduct,
  onSelectCategory,
  onSelectSuggestion,
  onImageSearch,
  showImageSearch = true,
}) {
  const catStart = products.length;
  const sugStart = products.length + categories.length;
  const hasResults = products.length || categories.length || suggestions.length;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-xl dark:border-white/10 dark:bg-[#1E1E1E]">
      {loading ? (
        <div className="p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-2 flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10" />
              <SkeletonBlock className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {products.length > 0 && (
            <div>
              <SectionHeader>Products</SectionHeader>
              {products.map((p, i) => (
                <button
                  key={`p-${p.id}`}
                  type="button"
                  onMouseEnter={() => onHoverIndex(i)}
                  onClick={() => onSelectProduct(p)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    activeIndex === i ? 'bg-brand-green/10' : ''
                  }`}
                >
                  <ProductImage
                    src={p.images?.[0]}
                    alt={p.name}
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                  />
                  <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                  <span className="text-sm font-bold text-brand-green">{formatPrice(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <SectionHeader>Suggestions</SectionHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {categories.map((c, j) => {
                  const idx = catStart + j;
                  return (
                    <button
                      key={`c-${c.id}`}
                      type="button"
                      onMouseEnter={() => onHoverIndex(idx)}
                      onClick={() => onSelectCategory(c)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        activeIndex === idx
                          ? 'border-brand-green bg-brand-green text-white'
                          : 'border-brand-green/40 text-brand-green hover:bg-brand-green/10'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <SectionHeader>Popular searches</SectionHeader>
              {suggestions.map((s, k) => {
                const idx = sugStart + k;
                return (
                  <button
                    key={`s-${s}`}
                    type="button"
                    onMouseEnter={() => onHoverIndex(idx)}
                    onClick={() => onSelectSuggestion(s)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                      activeIndex === idx ? 'bg-brand-green/10' : ''
                    }`}
                  >
                    <SearchIcon className="h-4 w-4 shrink-0 text-subtle" />
                    <span className="truncate">{s}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!hasResults && (
            <div className="px-4 py-6 text-center text-sm text-muted">No matches found.</div>
          )}

          {showImageSearch && onImageSearch && (
          <button
            type="button"
            onClick={onImageSearch}
            className="flex w-full items-center justify-center gap-2 border-t border-black/5 px-4 py-3.5 text-sm font-semibold text-brand-green hover:bg-brand-green/5 dark:border-white/10"
          >
            <CameraIcon className="h-4 w-4" />
            Search by image instead
          </button>
          )}
        </>
      )}
    </div>
  );
}
