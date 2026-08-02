import { Link } from 'react-router-dom';
import { useProducts } from '../../hooks/catalog';
import { useCartStore } from '../../store/cartStore';
import ProductImage from './ProductImage';
import ProductTile from '../home/ProductTile';
import { formatPrice } from '../../lib/currency';
import { SkeletonBlock } from '../ui/Skeleton';
import { isShopMarketplaceProduct } from '../../lib/marketplaceProduct';

export default function ProductCarouselSection({ title, categoryId, excludeId, viewAllTo }) {
  const { data, isLoading } = useProducts({
    sort: 'newest',
    page: 1,
    per_page: 8,
    ...(categoryId ? { category_id: categoryId } : {}),
  });

  const products = (data?.data ?? []).filter((p) => p.id !== excludeId).slice(0, 8);

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby={`carousel-${title}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 id={`carousel-${title}`} className="text-lg font-bold text-[#111111] dark:text-white">
          {title}
        </h2>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-sm font-bold text-brand-green hover:underline">
            View all →
          </Link>
        )}
      </div>
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-52 w-40 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
          {products.map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

export function FrequentlyBoughtTogether({ product, categoryId }) {
  const { data, isLoading } = useProducts({
    category_id: categoryId,
    page: 1,
    per_page: 6,
    sort: 'price_asc',
  });

  // Bundle cart is DPM-only — exclude marketplace shop listings.
  const others = (data?.data ?? [])
    .filter((p) => p.id !== product.id && !isShopMarketplaceProduct(p))
    .slice(0, 2);
  if (!categoryId || (!isLoading && others.length === 0)) return null;

  return <FrequentlyBoughtBlock product={product} others={others} isLoading={isLoading} />;
}

function FrequentlyBoughtBlock({ product, others, isLoading }) {
  const addItem = useCartStore((s) => s.addItem);

  if (isLoading) {
    return (
      <section className="mt-10">
        <SkeletonBlock className="h-32 w-full rounded-2xl" />
      </section>
    );
  }

  const bundle = [product, ...others];
  const total = bundle.reduce((s, p) => s + Number(p.price), 0);

  return (
    <section
      className="mt-10 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]"
      aria-labelledby="fbt-heading"
    >
      <h2 id="fbt-heading" className="text-lg font-bold">
        Frequently bought together
      </h2>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        {bundle.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-xl font-light text-muted">+</span>}
            <Link
              to={`/product/${p.slug}`}
              className="w-24 shrink-0 overflow-hidden rounded-xl border border-black/8 dark:border-white/10"
            >
              <ProductImage src={p.images?.[0]} alt={p.name} className="aspect-square w-full object-cover" />
              <p className="truncate p-1.5 text-[10px] font-semibold">{p.name}</p>
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-muted">
        Bundle total: <span className="font-bold text-brand-green">{formatPrice(total)}</span>
      </p>
      <button
        type="button"
        onClick={() => bundle.forEach((p) => addItem(p, 1))}
        className="btn-secondary mx-auto mt-3 block w-full max-w-sm py-3"
      >
        Add all to cart
      </button>
    </section>
  );
}
