import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCategories, useProducts } from '../hooks/catalog';
import ProductCard from '../components/product/ProductCard';
import FiltersPanel from '../components/shop/FiltersPanel';
import EmptyState from '../components/ui/EmptyState';
import { ProductGridSkeleton } from '../components/ui/Skeleton';
import { CloseIcon } from '../components/icons';

function flatten(nodes = []) {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function ShopPage() {
  const [searchParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);

  const [filters, setFilters] = useState(() => ({
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    price_min: '',
    price_max: '',
    in_stock: '',
    is_preorder: '',
    sort: 'newest',
    page: 1,
  }));

  const { data: catData } = useCategories();
  const categories = useMemo(() => flatten(catData?.data), [catData]);
  const selectedCategoryId = useMemo(
    () => categories.find((c) => c.slug === filters.category)?.id,
    [categories, filters.category]
  );

  const apiParams = useMemo(() => {
    const p = { sort: filters.sort, page: filters.page };
    if (selectedCategoryId) p.category_id = selectedCategoryId;
    if (filters.price_min !== '') p.price_min = filters.price_min;
    if (filters.price_max !== '') p.price_max = filters.price_max;
    if (filters.in_stock === '1') p.in_stock = '1';
    if (filters.is_preorder === '1') p.is_preorder = '1';
    if (filters.search) p.search = filters.search;
    return p;
  }, [filters, selectedCategoryId]);

  const { data, isLoading, isError } = useProducts(apiParams);
  const products = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, pages: 1 };

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const clear = () =>
    setFilters((f) => ({
      ...f,
      category: '',
      search: '',
      price_min: '',
      price_max: '',
      in_stock: '',
      is_preorder: '',
      page: 1,
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Shop {filters.search && <span className="text-subtle">/ &quot;{filters.search}&quot;</span>}
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileFilters(true)}
            className="rounded-lg border border-brand-green px-3 py-2 text-sm font-semibold text-brand-green md:hidden"
          >
            Filters
          </button>
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="input-field px-3 py-2 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 md:block">
          <FiltersPanel categories={categories} filters={filters} update={update} onClear={clear} />
        </aside>

        <div className="flex-1">
          {isLoading ? (
            <ProductGridSkeleton count={6} />
          ) : isError ? (
            <p className="py-16 text-center text-brand-red">Could not load products. Is the API running?</p>
          ) : products.length === 0 ? (
            <EmptyState
              title="No products found"
              message="Try adjusting your filters or browse the full catalogue."
              actionLabel="Clear filters"
              onAction={clear}
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-subtle">{meta.total} products</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {meta.pages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={meta.page <= 1}
                    onClick={() => update({ page: meta.page - 1 })}
                    className="rounded-lg border border-brand-green px-3 py-1.5 text-sm text-brand-green disabled:opacity-40"
                  >
                    Prev
                  </button>
                  {Array.from({ length: meta.pages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => update({ page: i + 1 })}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold ${
                        meta.page === i + 1
                          ? 'bg-brand-green text-white'
                          : 'border border-brand-green/30 text-brand-green'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={meta.page >= meta.pages}
                    onClick={() => update({ page: meta.page + 1 })}
                    className="rounded-lg border border-brand-green px-3 py-1.5 text-sm text-brand-green disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filters slide-over */}
      {mobileFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-brand-light p-5 dark:bg-brand-dark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button type="button" onClick={() => setMobileFilters(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <FiltersPanel categories={categories} filters={filters} update={update} onClear={clear} />
            <button
              type="button"
              onClick={() => setMobileFilters(false)}
              className="btn-primary mt-5 w-full"
            >
              Show {meta.total} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
