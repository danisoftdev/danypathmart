import ProductImage from '../product/ProductImage';
import { SkeletonBlock } from '../ui/Skeleton';
import { formatPrice } from '../../lib/currency';
import { SearchIcon, CameraIcon } from '../icons';

function SectionHeader({ children }) {
  return (
    <div className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-brand-gold">
      {children}
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
}) {
  const catStart = products.length;
  const sugStart = products.length + categories.length;
  const hasResults = products.length || categories.length || suggestions.length;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-black/5 bg-white shadow-xl dark:border-white/10 dark:bg-[#1c1c1c]">
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
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                    activeIndex === i ? 'bg-brand-green/10' : ''
                  }`}
                >
                  <ProductImage
                    src={p.images?.[0]}
                    alt={p.name}
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  <span className="text-sm font-semibold text-brand-green">{formatPrice(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <SectionHeader>Categories</SectionHeader>
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {categories.map((c, j) => {
                  const idx = catStart + j;
                  return (
                    <button
                      key={`c-${c.id}`}
                      type="button"
                      onMouseEnter={() => onHoverIndex(idx)}
                      onClick={() => onSelectCategory(c)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
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
              <SectionHeader>Popular Searches</SectionHeader>
              {suggestions.map((s, k) => {
                const idx = sugStart + k;
                return (
                  <button
                    key={`s-${s}`}
                    type="button"
                    onMouseEnter={() => onHoverIndex(idx)}
                    onClick={() => onSelectSuggestion(s)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                      activeIndex === idx ? 'bg-brand-green/10' : ''
                    }`}
                  >
                    <SearchIcon className="h-4 w-4 text-subtle" />
                    <span className="truncate">{s}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!hasResults && (
            <div className="px-4 py-6 text-center text-sm text-muted">No matches found.</div>
          )}

          <button
            type="button"
            onClick={onImageSearch}
            className="flex w-full items-center justify-center gap-2 border-t border-black/5 px-4 py-3 text-sm font-medium text-brand-emerald hover:bg-brand-emerald/10 dark:border-white/10"
          >
            <CameraIcon className="h-4 w-4" />
            Search by image instead
          </button>
        </>
      )}
    </div>
  );
}
