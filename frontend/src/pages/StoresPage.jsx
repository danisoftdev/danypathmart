import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { resolveProductImageUrl } from '../lib/productImages';
import EmptyState from '../components/ui/EmptyState';
import ProductRating from '../components/product/ProductRating';

function usePublicShops(q, city) {
  return useQuery({
    queryKey: ['public-shops', q, city],
    queryFn: async () =>
      (await api.get('/public/shops', { params: { q: q || undefined, city: city || undefined } })).data,
  });
}

export default function StoresPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const { data, isLoading } = usePublicShops(q, city);
  const shops = data?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 md:py-10">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand-green">Home</Link>
        {' / '}
        <span>Stores</span>
      </nav>
      <h1 className="text-2xl font-extrabold md:text-3xl">Browse shops</h1>
      <p className="mt-2 text-sm text-muted">Find sellers on DanyPathMart by name or city.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="input-field flex-1"
          placeholder="Search shop name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input-field sm:max-w-xs"
          placeholder="City (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted">Loading shops…</p>
      ) : shops.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="No shops found" message="Try a different search or check back later." actionLabel="Browse products" actionTo="/shop" />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <Link
              key={shop.id}
              to={`/stores/${shop.slug}`}
              className="flex gap-4 rounded-2xl border border-black/8 bg-white p-4 transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]"
            >
              {shop.logo_url ? (
                <img src={resolveProductImageUrl(shop.logo_url)} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-green/10 text-xl font-bold text-brand-green">
                  {shop.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{shop.name}</h2>
                {shop.city && <p className="text-xs text-muted">{shop.city}</p>}
                <ProductRating product={{ rating_avg: shop.rating_avg, rating_count: shop.rating_count }} />
                <p className="mt-1 text-xs text-muted">{shop.product_count} product{shop.product_count === 1 ? '' : 's'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
