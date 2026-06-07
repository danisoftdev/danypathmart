import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useOrders } from '../../hooks/account';
import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../lib/currency';
import { OrderListSkeleton } from '../../components/ui/Skeleton';
import ReferralCard from '../../components/dashboard/ReferralCard';

function QuickLink({ to, icon, label, desc }) {
  return (
    <Link
      to={to}
      className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 transition hover:border-brand-green hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-xl">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-[#111111] dark:text-white">{label}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
    </Link>
  );
}

export default function DashboardOverviewPage() {
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const { data: orders, isLoading } = useOrders();
  const recent = (orders || []).slice(0, 2);

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-brand-green to-[#1a5c38] p-6 text-white shadow-md">
        <p className="text-sm font-medium text-white/80">Hello,</p>
        <h1 className="mt-1 text-2xl font-extrabold">{user?.name?.split(' ')[0] || 'there'} 👋</h1>
        <p className="mt-2 text-sm text-white/90">Your marketplace account — orders, addresses &amp; security in one place.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/shop" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-green">
            Continue shopping
          </Link>
          {cartCount > 0 && (
            <Link to="/cart" className="rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-black">
              Cart ({cartCount})
            </Link>
          )}
        </div>
      </div>

      <ReferralCard />

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <QuickLink to="/dashboard/orders" icon="📦" label="My orders" desc="Track & reorder purchases" />
        <QuickLink to="/dashboard/wallet" icon="💰" label="Wallet" desc="Store credit & refunds" />
        <QuickLink to="/dashboard/addresses" icon="📍" label="Saved addresses" desc="Delivery locations" />
        <QuickLink to="/dashboard/security" icon="🔒" label="Security" desc="Password & 2FA" />
        <QuickLink to="/dashboard/settings" icon="⚙️" label="Settings" desc="Profile & addresses" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent orders</h2>
          <Link to="/dashboard/orders" className="text-sm font-bold text-brand-green hover:underline">
            View all
          </Link>
        </div>
        {isLoading ? (
          <OrderListSkeleton count={2} />
        ) : recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-muted dark:border-white/15">
            No orders yet.{' '}
            <Link to="/shop" className="font-bold text-brand-green hover:underline">Start shopping</Link>
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((o) => (
              <Link
                key={o.id}
                to={`/dashboard/orders/${o.id}`}
                className="flex items-center justify-between rounded-2xl border border-black/8 bg-white p-4 transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]"
              >
                <div>
                  <p className="font-bold">Order #{o.id}</p>
                  <p className="text-xs capitalize text-muted">{(o.status || '').replace(/_/g, ' ')}</p>
                </div>
                <span className="font-bold text-brand-green">{formatPrice(o.total, o.currency)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
