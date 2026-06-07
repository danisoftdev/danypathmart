import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrders } from '../../hooks/account';
import EmptyState from '../../components/ui/EmptyState';
import { OrderListSkeleton } from '../../components/ui/Skeleton';
import DashboardSection from '../../components/dashboard/DashboardSection';
import { formatPrice, resolveImageUrl } from '../../lib/currency';
import { reorderOrder } from '../../lib/reorder';
import { useAirLabels } from '../../hooks/checkout';

const STATUS_STYLES = {
  pending: 'bg-brand-gold/25 text-amber-900 dark:text-brand-gold',
  processing: 'bg-brand-green/15 text-brand-green',
  shipped: 'bg-brand-emerald/15 text-brand-emerald',
  out_for_delivery: 'bg-brand-orange/15 text-brand-orange',
  delivered: 'bg-brand-green/20 text-brand-green',
  cancelled: 'bg-brand-red/15 text-brand-red',
};

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-black/10 text-[#111111] dark:bg-white/10 dark:text-white';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${cls}`}>
      {statusLabel(status) || 'Unknown'}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function OrderCard({ order }) {
  const navigate = useNavigate();
  const labels = useAirLabels();
  const [reordering, setReordering] = useState(false);
  const thumb = order.thumbnails?.[0];
  const extraCount = Math.max(0, (order.item_count || 0) - 1);
  const canReorder = order.status !== 'cancelled';

  const handleReorder = async () => {
    setReordering(true);
    try {
      const ok = await reorderOrder(order.id);
      if (ok) navigate('/cart');
    } finally {
      setReordering(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]">
      <div className="flex gap-0 sm:gap-4">
        <Link
          to={`/dashboard/orders/${order.id}`}
          className="relative flex w-28 shrink-0 flex-col bg-black/[0.03] dark:bg-white/5 sm:w-32"
        >
          <div className="aspect-square w-full overflow-hidden">
            {thumb ? (
              <img src={resolveImageUrl(thumb)} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl opacity-40">📦</div>
            )}
          </div>
          {extraCount > 0 && (
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
              +{extraCount} more
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-[#111111] dark:text-white">
                Order #{order.id}
                {order.has_preorder && (
                  <span className="ml-2 rounded-md bg-brand-gold px-1.5 py-0.5 text-[10px] font-black text-black">
                    {labels.cartBadge}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatDate(order.created_at)}</p>
              <p className="mt-1 text-xs text-muted">
                {order.item_count} item{order.item_count === 1 ? '' : 's'}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <p className="mt-3 text-lg font-extrabold text-brand-green">{formatPrice(order.total, order.currency)}</p>

          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <Link
              to={`/dashboard/orders/${order.id}`}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 sm:flex-none sm:px-6"
            >
              Track order
            </Link>
            {canReorder && (
              <button
                type="button"
                onClick={handleReorder}
                disabled={reordering}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border-2 border-brand-green px-4 py-2.5 text-sm font-bold text-brand-green transition hover:bg-brand-green/5 disabled:opacity-50 sm:flex-none sm:px-6"
              >
                {reordering ? 'Adding…' : 'Reorder'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const { data: orders, isLoading, isError } = useOrders();

  if (isLoading) {
    return (
      <DashboardSection title="My orders" subtitle="Track deliveries and buy again in one tap.">
        <OrderListSkeleton count={3} />
      </DashboardSection>
    );
  }

  if (isError) {
    return (
      <DashboardSection title="My orders">
        <p className="text-sm text-brand-red">Could not load your orders. Please try again.</p>
      </DashboardSection>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <DashboardSection title="My orders" subtitle="Track deliveries and buy again in one tap.">
        <EmptyState
          title="No orders yet"
          message="When you place an order it will show up here with live tracking."
          actionLabel="Start shopping"
          actionTo="/shop"
        />
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="My orders" subtitle="Track deliveries and buy again in one tap.">
      <div className="space-y-4">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </DashboardSection>
  );
}
