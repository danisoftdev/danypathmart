import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCategories, useProductFacets, useProducts } from '../hooks/catalog';
import { flattenCategories } from '../lib/categories';
import ProductCard from '../components/product/ProductCard';
import ProductQuickView from '../components/product/ProductQuickView';
import FiltersPanel from '../components/shop/FiltersPanel';
import EmptyState from '../components/ui/EmptyState';
import { ProductGridSkeleton } from '../components/ui/Skeleton';
import { CloseIcon } from '../components/icons';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A–Z' },
  { value: 'name_desc', label: 'Name: Z–A' },
];

export default function ShopPage() {
  const [searchParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [accumulated, setAccumulated] = useState([]);
  const loadMoreRef = useRef(null);

  const [filters, setFilters] = useState(() => ({
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    tag: searchParams.get('tag') || '',
    price_min: '',
    price_max: '',
    in_stock: '',
    is_preorder: '',
    sort: searchParams.get('sort') || 'newest',
    page: 1,
  }));

  const { data: catData } = useCategories();
  const { data: facets } = useProductFacets();
  const categories = useMemo(() => flattenCategories(catData?.data), [catData]);
  const selectedCategory = categories.find((c) => c.slug === filters.category);
  const selectedCategoryId = selectedCategory?.id;

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        category: filters.category,
        search: filters.search,
        tag: filters.tag,
        price_min: filters.price_min,
        price_max: filters.price_max,
        in_stock: filters.in_stock,
        is_preorder: filters.is_preorder,
        sort: filters.sort,
      }),
    [filters.category, filters.search, filters.tag, filters.price_min, filters.price_max, filters.in_stock, filters.is_preorder, filters.sort]
  );

  const apiParams = useMemo(() => {
    const p = { sort: filters.sort, page: filters.page, per_page: 12 };
    if (selectedCategoryId) p.category_id = selectedCategoryId;
    if (filters.price_min !== '') p.price_min = filters.price_min;
    if (filters.price_max !== '') p.price_max = filters.price_max;
    if (filters.in_stock === '1') p.in_stock = '1';
    if (filters.is_preorder === '1') p.is_preorder = '1';
    if (filters.search) p.search = filters.search;
    if (filters.tag) p.tag = filters.tag;
    return p;
  }, [filters, selectedCategoryId]);

  const { data, isLoading, isFetching, isError } = useProducts(apiParams);
  const pageProducts = useMemo(() => data?.data ?? [], [data?.data]);
  const meta = data?.meta ?? { total: 0, page: 1, pages: 1 };

  // Sync paginated API results into an append-only list for infinite-scroll feel.
  /* eslint-disable react-hooks/set-state-in-effect -- merge paginated product API pages */
  useEffect(() => {
    if (isLoading) return;
    if (!pageProducts.length) {
      if (filters.page === 1) setAccumulated([]);
      return;
    }
    if (filters.page === 1) {
      setAccumulated(pageProducts);
      return;
    }
    setAccumulated((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const append = pageProducts.filter((p) => !ids.has(p.id));
      return append.length ? [...prev, ...append] : prev;
    });
    // filterKey reset: page returns to 1 and replaces list on next fetch
  }, [pageProducts, filters.page, isLoading, filterKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (patch) => {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  };

  const clear = () => {
    setAccumulated([]);
    setFilters((f) => ({
      ...f,
      category: '',
      search: '',
      tag: '',
      price_min: '',
      price_max: '',
      in_stock: '',
      is_preorder: '',
      page: 1,
    }));
  };

  const hasMore = meta.page < meta.pages;
  const loadingMore = isFetching && filters.page > 1;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore || isLoading || isFetching) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setFilters((f) => {
            if (f.page >= meta.pages) return f;
            return { ...f, page: f.page + 1 };
          });
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, isLoading, isFetching, meta.pages]);

  const activeFilterCount = [
    filters.category,
    filters.search,
    filters.tag,
    filters.price_min,
    filters.price_max,
    filters.in_stock,
    filters.is_preorder,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-4">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white">
          {selectedCategory ? selectedCategory.name : 'Shop all products'}
        </h1>
        {selectedCategory?.description && (
          <p className="mt-1 text-sm text-muted">{selectedCategory.description}</p>
        )}
        {filters.search && (
          <p className="mt-1 text-sm text-muted">
            Results for &ldquo;{filters.search}&rdquo;
          </p>
        )}
      </div>

      <div className="sticky top-[57px] z-30 -mx-4 mb-4 border-b border-black/8 bg-[#FFF9F3]/95 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#121212]/95 md:top-[65px]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileFilters(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-brand-green/40 bg-white px-4 py-2 text-sm font-bold text-brand-green md:hidden dark:bg-[#1E1E1E]"
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[10px] font-bold text-black">
                {activeFilterCount}
              </span>
            )}
          </button>
          <p className="hidden text-sm text-muted md:block">{meta.total} products</p>
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value })}
            aria-label="Sort products"
            className="input-field min-h-[44px] flex-1 px-3 py-2 text-sm font-semibold md:max-w-xs md:flex-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6 lg:gap-8">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E]">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-gold">Filters</h2>
            <FiltersPanel categories={categories} facets={facets} filters={filters} update={update} onClear={clear} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {isLoading && filters.page === 1 ? (
            <ProductGridSkeleton count={8} />
          ) : isError ? (
            <p className="py-16 text-center text-brand-red">Could not load products. Is the API running?</p>
          ) : accumulated.length === 0 ? (
            <EmptyState
              title="No products found"
              message="Try adjusting your filters or browse the full catalogue."
              actionLabel="Clear filters"
              onAction={clear}
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted md:hidden">{meta.total} products</p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {accumulated.map((p) => (
                  <ProductCard key={p.id} product={p} onQuickView={setQuickViewProduct} />
                ))}
              </div>

              {hasMore && (
                <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
                  {loadingMore ? (
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-green/30 border-t-brand-green" aria-label="Loading more" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                      className="btn-ghost px-6 py-2.5"
                    >
                      Load more
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close filters" onClick={() => setMobileFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[#FFF9F3] p-5 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button type="button" onClick={() => setMobileFilters(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <FiltersPanel categories={categories} facets={facets} filters={filters} update={update} onClear={clear} />
            <button type="button" onClick={() => setMobileFilters(false)} className="btn-primary mt-5 w-full py-3">
              Show {meta.total} results
            </button>
          </div>
        </div>
      )}

      <ProductQuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
}
