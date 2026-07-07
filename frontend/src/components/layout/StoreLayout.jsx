import { Link, Outlet, useParams } from 'react-router-dom';
import { usePublicStore } from '../../hooks/shop';
import { useStoreCartStore } from '../../store/storeCartStore';
import { resolveProductImageUrl } from '../../lib/productImages';

export default function StoreLayout() {
  const { slug } = useParams();
  const { data } = usePublicStore(slug);
  const shop = data?.shop;
  const cartCount = useStoreCartStore((s) => (s.shopSlug === slug ? s.totalItems() : 0));

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212]">
      <header className="sticky top-0 z-40 border-b border-black/8 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#1A1A1A]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {shop?.logo_url ? (
              <img src={resolveProductImageUrl(shop.logo_url)} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-sm font-extrabold text-brand-green">
                {(shop?.name || 'S').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-extrabold text-[#111111] dark:text-white">{shop?.name || 'Shop'}</p>
              <p className="text-xs text-muted">Powered by DanyPathMart</p>
            </div>
          </div>
          <Link
            to={`/stores/${slug}/cart`}
            className="relative flex min-h-[40px] items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-bold dark:border-white/15"
          >
            Cart
            {cartCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-green px-1 text-xs text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>
      <Outlet context={{ shop, paymentMethods: data?.payment_methods ?? [] }} />
    </div>
  );
}
