import { Link, Outlet, useParams } from 'react-router-dom';
import { usePublicStore } from '../../hooks/shop';
import { useStoreCartStore } from '../../store/storeCartStore';
import { resolveProductImageUrl } from '../../lib/productImages';

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function looksLikePhone(phone) {
  const digits = phoneDigits(phone);
  return digits.length >= 9 && digits.length <= 15;
}

export default function StoreLayout() {
  const { slug } = useParams();
  const { data, isError, isLoading } = usePublicStore(slug);
  const shop = data?.shop;
  const mode = shop?.storefront_mode || 'focused';
  const cartCount = useStoreCartStore((s) => (s.shopSlug === slug ? s.totalItems() : 0));
  const showExplore = mode === 'open';
  const showSoftExit = mode === 'focused';
  const csPhone = shop?.customer_service_phone || shop?.contact_phone;
  const tel = looksLikePhone(csPhone) ? `tel:${phoneDigits(csPhone)}` : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] dark:bg-[#121212]">
      <header className="sticky top-0 z-40 border-b border-black/8 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#1A1A1A]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to={`/stores/${slug}`} className="flex min-w-0 items-center gap-3">
            {shop?.logo_url ? (
              <img src={resolveProductImageUrl(shop.logo_url)} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green/10 text-sm font-extrabold text-brand-green">
                {(shop?.name || 'S').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-extrabold text-[#111111] dark:text-white">{shop?.name || (isLoading ? 'Loading…' : 'Shop')}</p>
              <p className="text-xs text-muted">Powered by DanyPathMart</p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {tel && (
              <a
                href={tel}
                className="hidden min-h-[40px] items-center rounded-xl border border-black/10 px-3 text-sm font-bold sm:inline-flex dark:border-white/15"
              >
                Call shop
              </a>
            )}
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
        </div>
      </header>

      <main className="flex-1">
        {isError ? (
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <h1 className="text-xl font-extrabold">Store not available</h1>
            <p className="mt-2 text-sm text-muted">This shop link is invalid, unpublished, or temporarily offline.</p>
            {showExplore || showSoftExit ? (
              <Link to="/" className="btn-primary mt-6 inline-flex min-h-[44px] items-center px-6">
                Go to DanyPathMart
              </Link>
            ) : null}
          </div>
        ) : (
          <Outlet context={{ shop, paymentMethods: data?.payment_methods ?? [], storefrontMode: mode }} />
        )}
      </main>

      <footer className="border-t border-black/8 bg-white px-4 py-6 dark:border-white/10 dark:bg-[#1A1A1A]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted">
            {shop?.name ? (
              <>
                Shopping at <span className="font-bold text-[#111111] dark:text-white">{shop.name}</span>
              </>
            ) : (
              'Shop storefront'
            )}
            {' · '}
            <span className="font-semibold text-brand-green">Powered by DanyPathMart</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {showExplore && (
              <>
                <Link to="/stores" className="font-bold text-brand-green hover:underline">Browse shops</Link>
                <Link to="/shop" className="font-bold text-brand-green hover:underline">DPM catalog</Link>
                <Link to="/" className="font-bold text-brand-green hover:underline">DanyPathMart home</Link>
              </>
            )}
            {showSoftExit && (
              <Link to="/" className="text-muted hover:text-brand-green hover:underline">
                Explore DanyPathMart
              </Link>
            )}
            {/* locked: no marketplace exit links */}
          </div>
        </div>
      </footer>
    </div>
  );
}
