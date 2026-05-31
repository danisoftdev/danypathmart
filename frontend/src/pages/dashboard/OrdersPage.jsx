import { Link } from 'react-router-dom';
import { useOrders } from '../../hooks/account';
import { formatPrice, resolveImageUrl } from '../../lib/currency';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  processing: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-300',
  out_for_delivery: 'bg-purple-100 text-purple-800 dark:bg-purple-400/15 dark:text-purple-300',
  delivered: 'bg-brand-green/15 text-brand-green',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300',
};

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-black/10 text-black/70 dark:bg-white/10 dark:text-white/70';
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
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-brand-red">Could not load your orders. Please try again.</p>;
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-10 text-center dark:border-white/10 dark:bg-[#161616]">
        <h2 className="text-lg font-semibold">No orders yet</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          When you place an order it will show up here with live tracking.
        </p>
        <Link to="/shop" className="btn-primary mt-5 inline-block">Start shopping</Link>
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
            className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 dark:border-white/10 dark:bg-[#161616]"
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
                <p className="text-xs text-black/50 dark:text-white/50">{formatDate(order.created_at)}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex -space-x-3">
                {order.thumbnails.slice(0, 4).map((t, i) => (
                  <div
                    key={i}
                    className="h-12 w-12 overflow-hidden rounded-lg border-2 border-white bg-black/5 dark:border-[#161616] dark:bg-white/10"
                  >
                    {t ? (
                      <img src={resolveImageUrl(t)} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                ))}
                <span className="ml-5 self-center text-xs text-black/50 dark:text-white/50">
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
