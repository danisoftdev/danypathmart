import { Link, useParams } from 'react-router-dom';
import { usePublicStore } from '../hooks/shop';
import ProductCard from '../components/product/ProductCard';
import LocationMapView from '../components/map/LocationMapView';
import { resolveProductImageUrl } from '../lib/productImages';
import EmptyState from '../components/ui/EmptyState';
import { ProductGridSkeleton } from '../components/ui/Skeleton';

export default function StorePage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = usePublicStore(slug);

  const shop = data?.shop;
  const products = data?.products ?? [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 pb-24">
        <div className="mb-8 h-24 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (isError || !shop) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Store not found"
          message="This shop may be unpublished or the link is incorrect."
          actionLabel="Browse shop"
          actionTo="/shop"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 md:py-10">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/shop" className="hover:text-brand-green">Shop</Link>
        {' / '}
        <span>{shop.name}</span>
      </nav>

      <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E] sm:flex-row sm:items-center">
        {shop.logo_url ? (
          <img src={resolveProductImageUrl(shop.logo_url)} alt="" className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-green/10 text-2xl font-extrabold text-brand-green">
            {shop.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">{shop.name}</h1>
          {shop.city && <p className="mt-1 text-sm text-muted">{shop.city}</p>}
          {shop.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{shop.description}</p>
          )}
          {shop.allows_shop_pickup && (
            <p className="mt-2 inline-block rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-xs font-bold text-brand-gold">
              In-person pickup available
            </p>
          )}
        </div>
      </header>

      {shop.has_map_pin && (
        <section className="mb-8 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
          <LocationMapView
            latitude={shop.latitude}
            longitude={shop.longitude}
            streetAddress={shop.street_address}
            city={shop.city}
            region={shop.region}
            directionsUrl={shop.directions_url}
            label="Find this shop"
            height={260}
          />
        </section>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-muted">No products listed yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
