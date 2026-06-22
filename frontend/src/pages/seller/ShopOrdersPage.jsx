import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useShopOrderDetail,
  useShopOrders,
  useUpdateShopOrderStatus,
} from '../../hooks/shop';
import { formatPrice, resolveImageUrl } from '../../lib/currency';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

const STATUS_OPTIONS = [
  { value: 'preparing', label: 'Preparing' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
];

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ');
}

export default function ShopOrdersPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get('f') || 0) || null;
  const { data: orders = [], isLoading } = useShopOrders();
  const { data: detailData, isLoading: detailLoading } = useShopOrderDetail(selectedId);
  const updateStatus = useUpdateShopOrderStatus();
  const [nextStatus, setNextStatus] = useState('preparing');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const fulfillment = detailData?.fulfillment ?? null;

  const selectOrder = (id) => {
    setParams(id ? { f: String(id) } : {});
    setError('');
  };

  const handleStatus = async (e) => {
    e.preventDefault();
    if (!selectedId || !nextStatus) return;
    setError('');
    try {
      await updateStatus.mutateAsync({ id: selectedId, status: nextStatus, note: note.trim() || undefined });
      setNote('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status.');
    }
  };

  const canUpdate = fulfillment && !['awaiting_payment', 'cancelled', 'delivered'].includes(fulfillment.status);

  return (
    <div>
      <h1 className="text-xl font-extrabold md:text-2xl">Orders</h1>
      <p className="mt-1 text-sm text-muted">
        Paid marketplace orders — you deliver to the customer. Delivery fees are arranged offline with the buyer.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="admin-panel overflow-x-auto p-2">
          {isLoading ? (
            <AdminTableSkeleton rows={5} cols={1} />
          ) : orders.length === 0 ? (
            <p className="p-3 text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="space-y-1">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => selectOrder(o.id)}
                    className={[
                      'w-full rounded-xl px-3 py-2 text-left text-sm transition',
                      selectedId === o.id ? 'bg-brand-green/15 ring-1 ring-brand-green/40' : 'hover:bg-black/5 dark:hover:bg-white/5',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">Order #{o.order_id}</span>
                      <span className="text-xs uppercase text-muted">{o.status}</span>
                    </div>
                    <p className="text-xs text-muted">{o.customer_name}</p>
                    <p className="mt-1 font-semibold text-brand-green">{formatPrice(o.subtotal)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-panel min-h-[320px] p-4">
          {!selectedId ? (
            <p className="text-sm text-muted">Select an order to view delivery details and update status.</p>
          ) : detailLoading ? (
            <AdminTableSkeleton rows={4} cols={1} />
          ) : !fulfillment ? (
            <p className="text-sm text-muted">Order not found.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold">Order #{fulfillment.order_id}</h2>
                <p className="text-sm text-muted capitalize">Status: {statusLabel(fulfillment.status)}</p>
              </div>

              <div className="rounded-xl border border-black/8 bg-black/[0.02] p-3 text-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Deliver to</p>
                <p className="mt-1 font-semibold">{fulfillment.customer_name}</p>
                <p className="text-muted">{fulfillment.customer_phone || fulfillment.address_phone}</p>
                <p className="mt-2">{fulfillment.delivery_address || '—'}</p>
                <p className="mt-2 text-xs text-muted">{fulfillment.customer_email}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Your items</p>
                <ul className="mt-2 space-y-2">
                  {(fulfillment.items ?? []).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-xl border border-black/8 p-2 dark:border-white/10">
                      {item.image && (
                        <img src={resolveImageUrl(item.image)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{item.name}</p>
                        <p className="text-xs text-muted">Qty {item.quantity} × {formatPrice(item.unit_price)}</p>
                      </div>
                      <span className="font-bold">{formatPrice(item.line_total)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {(fulfillment.tracking ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Delivery updates</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {fulfillment.tracking.map((t, idx) => (
                      <li key={`${t.status}-${idx}`} className="rounded-lg bg-black/[0.03] px-3 py-2 dark:bg-white/5">
                        <p className="font-semibold capitalize">{statusLabel(t.status)}</p>
                        {t.note && <p className="text-muted">{t.note}</p>}
                        <p className="text-xs text-muted">{formatWhen(t.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canUpdate && (
                <form onSubmit={handleStatus} className="space-y-3 border-t border-black/8 pt-4 dark:border-white/10">
                  <p className="text-sm font-bold">Update delivery status</p>
                  {error && <p className="text-sm text-brand-red">{error}</p>}
                  <select className="input-field w-full" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <input className="input-field w-full" placeholder="Note to customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={updateStatus.isPending}>
                    {updateStatus.isPending ? 'Saving…' : 'Save status'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
