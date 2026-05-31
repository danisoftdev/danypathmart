import { Link } from 'react-router-dom';
import { useOrders } from '../../hooks/account';
import EmptyState from '../../components/ui/EmptyState';
import { OrderListSkeleton } from '../../components/ui/Skeleton';
import { formatPrice, resolveImageUrl } from '../../lib/currency';

const STATUS_STYLES = {
  pending: 'bg-brand-gold/20 text-amber-800 dark:text-brand-gold',
  processing: 'bg-brand-green/15 text-brand-green',
  shipped: 'bg-brand-emerald/15 text-brand-emerald',
  out_for_delivery: 'bg-brand-orange/15 text-brand-orange',
  delivered: 'bg-brand-green/15 text-brand-green',
  cancelled: 'bg-brand-red/15 text-brand-red',
};

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-black/10 text-[#111111] dark:bg-white/10 dark:text-white';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
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

export default function OrdersPage() {
  const { data: orders, isLoading, isError } = useOrders();

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-bold">My Orders</h1>
        <OrderListSkeleton count={3} />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-brand-red">Could not load your orders. Please try again.</p>;
  }

  if (!orders || orders.length === 0) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-bold">My Orders</h1>
        <EmptyState
          title="No orders yet"
          message="When you place an order it will show up here with live tracking."
          actionLabel="Start shopping"
          actionTo="/shop"
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="card-brand p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  Order #{order.id}
                  {order.has_preorder && (
                    <span className="ml-2 rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-black">
                      PRE-ORDER
                    </span>
                  )}
                </p>
                <p className="text-xs text-subtle">{formatDate(order.created_at)}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex -space-x-3">
                {order.thumbnails.slice(0, 4).map((t, i) => (
                  <div
                    key={i}
                    className="h-12 w-12 overflow-hidden rounded-lg border-2 border-white bg-black/5 dark:border-[#1C1C1C] dark:bg-white/10"
                  >
                    {t ? (
                      <img src={resolveImageUrl(t)} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                ))}
                <span className="ml-5 self-center text-xs text-subtle">
                  {order.item_count} item{order.item_count === 1 ? '' : 's'}
                </span>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold">{formatPrice(order.total, order.currency)}</p>
                <Link
                  to={`/dashboard/orders/${order.id}`}
                  className="mt-1 inline-block text-xs font-semibold text-brand-green hover:underline"
                >
                  View details &rarr;
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
