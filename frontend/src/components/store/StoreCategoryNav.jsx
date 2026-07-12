import { Link, useLocation } from 'react-router-dom';
import { useCategories } from '../../hooks/catalog';
import { usePlatformFeatures } from '../../hooks/checkout';

export default function StoreCategoryNav() {
  const { pathname } = useLocation();
  const { data } = useCategories();
  const { marketplaceEnabled, shopApplicationsOpen } = usePlatformFeatures();
  const topLevel = (data?.data ?? []).filter((c) => !c.parent_id).slice(0, 12);

  if (pathname.startsWith('/admin') || pathname.startsWith('/seller') || pathname.startsWith('/driver') || pathname.startsWith('/station')) {
    return null;
  }

  return (
    <nav
      className="hidden border-b border-black/8 bg-white dark:border-white/10 dark:bg-[#161616] md:block"
      aria-label="Store navigation"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4">
        <Link
          to="/shop"
          className="shrink-0 py-2.5 pr-2 text-xs font-bold text-brand-green hover:underline"
        >
          All products
        </Link>
        <span className="h-4 w-px shrink-0 bg-black/10 dark:bg-white/15" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-1 scrollbar-hide">
          {topLevel.map((cat) => (
            <Link
              key={cat.id}
              to={`/shop?category=${cat.slug}`}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#111111]/80 transition hover:bg-brand-green/10 hover:text-brand-green dark:text-white/80 dark:hover:text-brand-green"
            >
              {cat.name}
            </Link>
          ))}
          <Link
            to="/kits"
            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#111111]/80 transition hover:bg-brand-green/10 hover:text-brand-green dark:text-white/80"
          >
            Kits
          </Link>
          <Link
            to="/group-order"
            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#111111]/80 transition hover:bg-brand-green/10 hover:text-brand-green dark:text-white/80"
          >
            Group order
          </Link>
          {marketplaceEnabled && (
            <Link
              to="/stores"
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#111111]/80 transition hover:bg-brand-green/10 hover:text-brand-green dark:text-white/80 dark:hover:text-brand-green"
            >
              Browse shops
            </Link>
          )}
          {marketplaceEnabled && shopApplicationsOpen && (
            <Link
              to="/sell"
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand-gold transition hover:bg-brand-gold/10"
            >
              Sell on DPM
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
