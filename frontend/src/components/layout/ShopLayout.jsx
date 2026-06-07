import { Link, NavLink, Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useConfirmShopBillingDevPayment, useInitializeShopRenewalPayment, useShopDashboard } from '../../hooks/shop';
import { useAuthStore } from '../../store/authStore';
import UserAvatar from '../brand/UserAvatar';
import { resolveProductImageUrl } from '../../lib/productImages';
import { formatPrice } from '../../lib/currency';

const NAV = [
  { to: '/seller', end: true, label: 'Overview', icon: '📊' },
  { to: '/seller/products', end: false, label: 'Products', icon: '🏷️' },
  { to: '/seller/orders', end: false, label: 'Orders', icon: '📦' },
  { to: '/seller/wallet', end: false, label: 'Wallet', icon: '💰' },
  { to: '/seller/settings', end: false, label: 'Profile', icon: '⚙️' },
];

export default function ShopLayout() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error, refetch } = useShopDashboard(!!user);
  const initRenewal = useInitializeShopRenewalPayment();
  const confirmDev = useConfirmShopBillingDevPayment();
  const [searchParams, setSearchParams] = useSearchParams();
  const [renewalMsg, setRenewalMsg] = useState('');

  useEffect(() => {
    const isRenewalReturn = searchParams.get('shop_payment') === 'renewal';
    const ref = searchParams.get('reference') || '';
    const isMock = searchParams.get('mock') === '1';
    if (!isRenewalReturn || !isMock || !ref) return;
    (async () => {
      try {
        await confirmDev.mutateAsync({ reference: ref, type: 'renewal' });
        setRenewalMsg('Renewal payment confirmed.');
        refetch();
      } catch {
        setRenewalMsg('Could not confirm renewal payment.');
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, confirmDev, setSearchParams, refetch]);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/seller' }} />;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center text-sm text-muted">
        Loading your shop…
      </div>
    );
  }

  if (isError || !data?.shop) {
    const forbidden = error?.response?.status === 403;
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Seller dashboard</h1>
        <p className="mt-3 text-sm text-muted">
          {forbidden
            ? 'You do not have an active shop yet. Apply to sell on DanyPathMart and we will email you when approved.'
            : 'Could not load your shop dashboard.'}
        </p>
        {forbidden && (
          <Link to="/sell" className="btn-primary mt-6 inline-flex min-h-[44px] items-center px-6">
            Apply to sell
          </Link>
        )}
        <Link to="/" className="mt-4 block text-sm font-bold text-brand-green hover:underline">
          Back to store
        </Link>
      </div>
    );
  }

  const shop = data.shop;
  const billing = data.billing ?? {};
  const renewalFee = Number(billing.settings?.renewal_fee || 0);
  const showRenewal = billing.settings?.enabled && renewalFee > 0 && billing.renewal_due;

  const payRenewal = async () => {
    setRenewalMsg('');
    try {
      const pay = await initRenewal.mutateAsync();
      if (pay.authorization_url) {
        window.location.href = pay.authorization_url;
      }
    } catch (err) {
      setRenewalMsg(err.response?.data?.message || 'Could not start renewal payment.');
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 pb-24 md:py-8">
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] sm:flex-row sm:items-center">
        {shop.logo_url ? (
          <img src={resolveProductImageUrl(shop.logo_url)} alt="" className="h-14 w-14 rounded-xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-green/10 text-lg font-extrabold text-brand-green">
            {shop.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Seller dashboard</p>
          <p className="truncate font-bold">{shop.name}</p>
          <Link to={`/stores/${shop.slug}`} className="text-xs font-bold text-muted hover:text-brand-green">
            View public store →
          </Link>
        </div>
        <UserAvatar user={user} className="h-12 w-12 shrink-0" />
      </div>

      {renewalMsg && (
        <p className="mb-4 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm">{renewalMsg}</p>
      )}

      {showRenewal && (
        <div className="mb-6 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-4">
          <p className="text-sm font-bold">Shop renewal due</p>
          <p className="mt-1 text-sm text-muted">
            Pay {formatPrice(renewalFee)} to keep your shop listed ({billing.settings?.renewal_period || 'yearly'} plan).
          </p>
          <button
            type="button"
            className="btn-primary mt-3 min-h-[40px] px-4 text-sm"
            disabled={initRenewal.isPending}
            onClick={payRenewal}
          >
            {initRenewal.isPending ? 'Starting payment…' : `Renew — ${formatPrice(renewalFee)}`}
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5 rounded-2xl border border-black/8 bg-white p-2 dark:border-white/10 dark:bg-[#1E1E1E]">
            {NAV.map(({ to, end, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    isActive
                      ? 'bg-brand-green text-white'
                      : 'text-[#111111]/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5',
                  ].join(' ')
                }
              >
                <span aria-hidden>{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div>
          <nav className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
            {NAV.map(({ to, end, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? 'admin-mobile-pill-active shrink-0' : 'admin-mobile-pill shrink-0')}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <Outlet context={{ shop, dashboard: data }} />
        </div>
      </div>
    </section>
  );
}
