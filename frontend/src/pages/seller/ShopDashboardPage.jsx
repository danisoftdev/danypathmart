import { Link, useOutletContext } from 'react-router-dom';
import ShopSharePanel from '../../components/shop/ShopSharePanel';
import { formatPrice } from '../../lib/currency';

function StatCard({ label, value, hint, to }) {
  const inner = (
    <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-brand-green">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  if (to) {
    return <Link to={to} className="block transition hover:opacity-90">{inner}</Link>;
  }
  return inner;
}

export default function ShopDashboardPage() {
  const { dashboard } = useOutletContext();
  const wallet = dashboard?.wallet ?? {};
  const earnings = dashboard?.recent_earnings ?? [];

  return (
    <div>
      <h1 className="text-xl font-extrabold md:text-2xl">Overview</h1>
      <p className="mt-1 text-sm text-muted">Track listings, orders, and earnings for your shop.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={dashboard?.product_count ?? 0} to="/seller/products" />
        <StatCard
          label="Pending review"
          value={dashboard?.pending_listings ?? 0}
          hint="Awaiting admin approval"
          to="/seller/products"
        />
        <StatCard
          label="Available balance"
          value={formatPrice(wallet.balance_available ?? 0)}
          to="/seller/payments"
        />
        <StatCard
          label="Pending earnings"
          value={formatPrice(wallet.balance_pending ?? 0)}
          hint="Released when orders complete"
          to="/seller/payments"
        />
      </div>

      <ShopSharePanel sharing={dashboard?.sharing} />

      <section className="mt-8 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Recent earnings</h2>
          <Link to="/seller/payments" className="text-xs font-bold text-brand-green hover:underline">
            View payments
          </Link>
        </div>
        {earnings.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Earnings appear here after customers pay for your products.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10">
            {earnings.map((e) => (
              <li key={e.id ?? `${e.order_id}-${e.created_at}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">Order #{e.order_id}</p>
                  <p className="text-xs text-muted">{e.status}</p>
                </div>
                <span className="font-bold text-brand-green">{formatPrice(e.shop_net_amount ?? e.amount ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
