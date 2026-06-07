import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useOrder, useCancelOrder } from '../../hooks/checkout';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import CompletePaymentPanel from '../../components/checkout/CompletePaymentPanel';
import PrintExportActions from '../../components/ui/PrintExportActions';
import { formatPrice, resolveImageUrl } from '../../lib/currency';
import { downloadGroupRosterCsv } from '../../lib/csvExport';
import { isGroupOrder, printGroupRoster, printReceipt, rosterLinesFromOrder } from '../../lib/orderDocuments';
import { useCompanyStore } from '../../store/companyStore';
import { reorderOrder } from '../../lib/reorder';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';
import { useAirLabels } from '../../hooks/checkout';
import { timelineStepsForOrder, formatStationAddress } from '../../lib/orderStatus';

function formatStamp(value) {
  if (!value) return '';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function Timeline({ tracking, cancelled, currentStatus, steps }) {
  const byStatus = {};
  tracking.forEach((t) => {
    byStatus[t.status] = t;
  });

  const reachedIndexes = steps.map((s, i) => (byStatus[s.key] ? i : -1)).filter((i) => i >= 0);
  const currentIndex = reachedIndexes.length ? Math.max(...reachedIndexes) : -1;
  const finalKey = steps[steps.length - 1]?.key;
  const delivered = currentIndex === steps.length - 1 && !!byStatus[finalKey];

  if (cancelled) {
    const c = tracking.find((t) => t.status === 'cancelled');
    return (
      <div className="rounded-2xl border-2 border-brand-red/30 bg-brand-red/5 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red/15 text-xl">✕</span>
          <div>
            <p className="font-bold text-brand-red">Order cancelled</p>
            {c?.note && <p className="mt-1 text-sm text-muted">{c.note}</p>}
            {c?.created_at && <p className="mt-1 text-xs text-muted">{formatStamp(c.created_at)}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E] sm:p-6">
      {currentStatus && (
        <div className="mb-6 rounded-xl bg-brand-green/10 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Current status</p>
          <p className="mt-1 text-lg font-extrabold capitalize text-[#111111] dark:text-white">
            {(currentStatus || '').replace(/_/g, ' ')}
          </p>
        </div>
      )}

      <ol className="space-y-0">
        {steps.map((step, i) => {
          const entry = byStatus[step.key];
          const isCompleted = i < currentIndex || (i === currentIndex && delivered);
          const isActive = i === currentIndex && !delivered;
          const isUpcoming = i > currentIndex;
          const isLast = i === steps.length - 1;

          let nodeClass;
          if (isCompleted) nodeClass = 'bg-brand-green text-white ring-4 ring-brand-green/20';
          else if (isActive) nodeClass = 'bg-brand-gold text-black ring-4 ring-brand-gold/30 animate-pulse';
          else nodeClass = 'bg-black/5 text-transparent dark:bg-white/10';

          return (
            <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast && (
                <span
                  className={[
                    'absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5',
                    isCompleted ? 'bg-brand-green' : 'bg-black/10 dark:bg-white/10',
                  ].join(' ')}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${nodeClass}`}
              >
                {isCompleted ? <CheckIcon /> : isActive ? <span className="h-2.5 w-2.5 rounded-full bg-black" /> : null}
              </span>
              <div className={`min-w-0 flex-1 pt-1 ${isUpcoming ? 'opacity-45' : ''}`}>
                <p
                  className={[
                    'text-base font-bold',
                    isActive ? 'text-brand-gold' : isCompleted ? 'text-brand-green' : 'text-[#111111] dark:text-white',
                  ].join(' ')}
                >
                  {step.label}
                </p>
                <p className="text-sm text-muted">{step.desc}</p>
                {entry?.created_at && (
                  <p className="mt-1 text-xs font-medium text-muted">{formatStamp(entry.created_at)}</p>
                )}
                {entry?.note && <p className="mt-1 rounded-lg bg-black/[0.03] px-3 py-2 text-sm italic dark:bg-white/5">{entry.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useOrder(id);
  const cancelOrder = useCancelOrder();
  const company = useCompanyStore((s) => s.company);
  const labels = useAirLabels();
  const [reordering, setReordering] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const order = data?.order;

  const handleReorder = async () => {
    setReordering(true);
    try {
      const ok = await reorderOrder(id);
      if (ok) navigate('/cart');
    } finally {
      setReordering(false);
    }
  };

  if (isLoading) {
    return <FormPanelSkeleton sections={2} />;
  }
  if (isError || !order) {
    return (
      <div>
        <p className="text-sm text-brand-red">Could not load this order.</p>
        <Link to="/dashboard/orders" className="mt-3 inline-block text-sm font-bold text-brand-green hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const tracking = order.tracking || [];
  const cancelled = order.status === 'cancelled' || tracking.some((t) => t.status === 'cancelled');
  const steps = timelineStepsForOrder(order);
  const canReorder = !cancelled;
  const canCancel = order?.can_cancel && !cancelled;

  const handleCancel = async () => {
    setCancelError('');
    try {
      await cancelOrder.mutateAsync({ id: order.id, reason: cancelReason.trim() });
      setCancelOpen(false);
      setCancelReason('');
      refetch();
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Could not cancel order.');
    }
  };

  return (
    <div className="pb-6">
      <Link
        to="/dashboard/orders"
        className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-green hover:underline"
      >
        ← All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Order #{order.id}</h1>
          {order.organization_name && (
            <p className="mt-1 text-sm font-semibold text-brand-green">{order.organization_name}</p>
          )}
          {order.order_type && order.order_type !== 'retail' && (
            <span className="mt-2 mr-2 inline-block rounded-md bg-brand-green/15 px-2 py-0.5 text-xs font-bold uppercase text-brand-green">
              {order.order_type.replace(/_/g, ' ')}
            </span>
          )}
          {order.has_preorder && (
            <span className="mt-2 inline-block rounded-md bg-brand-gold px-2 py-0.5 text-xs font-black text-black">
              {labels.cartBadge}
            </span>
          )}
        </div>
        {canReorder && (
          <button
            type="button"
            onClick={handleReorder}
            disabled={reordering}
            className="min-h-[44px] rounded-xl border-2 border-brand-green px-5 py-2.5 text-sm font-bold text-brand-green hover:bg-brand-green/5 disabled:opacity-50"
          >
            {reordering ? 'Adding to cart…' : 'Reorder all items'}
          </button>
        )}
        <PrintExportActions
          actions={[
            { label: 'Print receipt', onClick: () => printReceipt(order, company) },
            ...(isGroupOrder(order)
              ? [
                  {
                    label: 'Print roster',
                    onClick: () =>
                      printGroupRoster({ organizationName: order.organization_name, order, company }),
                  },
                  {
                    label: 'Export roster CSV',
                    onClick: () =>
                      downloadGroupRosterCsv(
                        order.organization_name,
                        rosterLinesFromOrder(order),
                        order.id
                      ),
                  },
                ]
              : []),
          ]}
        />
        {canCancel && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="min-h-[44px] rounded-xl border-2 border-brand-red px-5 py-2.5 text-sm font-bold text-brand-red hover:bg-brand-red/5"
          >
            Cancel order
          </button>
        )}
      </div>

      {cancelled && order.cancel_reason && (
        <p className="mb-4 rounded-xl border border-brand-red/30 bg-brand-red/5 px-4 py-3 text-sm">
          <span className="font-bold">Cancellation reason: </span>
          {order.cancel_reason}
          {order.cancelled_by === 'customer' && (
            <span className="mt-1 block text-xs text-muted">Cancelled by you — contact support if you need this order restored.</span>
          )}
        </p>
      )}

      <div className="space-y-6">
        {order.payment_status === 'pending' && !cancelled && (
          <p className="rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-4 py-3 text-sm font-medium text-amber-900 dark:text-brand-gold">
            Awaiting payment — we will start preparing your order once Paystack confirms your payment.
          </p>
        )}

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Delivery progress</h2>
          <Timeline tracking={tracking} cancelled={cancelled} currentStatus={order.status} steps={steps} />
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E] sm:p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Items in this order</h2>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {(order.items || []).map((it) => (
              <li key={it.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/5 dark:bg-white/10">
                  {it.image ? (
                    <img src={resolveImageUrl(it.image)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl opacity-30">📦</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{it.name}</p>
                  {(it.recipient_name || it.size_label) && (
                    <p className="text-xs font-semibold text-brand-green">
                      {[it.recipient_name, it.size_label && `Size ${it.size_label}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="mt-0.5 text-sm text-muted">Qty {it.quantity}</p>
                </div>
                <span className="shrink-0 font-bold">{formatPrice(it.line_total)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm dark:border-white/10">
            <div className="flex justify-between text-muted">
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            {order.intl_shipping_cost > 0 && (
              <div className="flex justify-between text-muted">
                <dt>{labels.intlShippingTitle}</dt>
                <dd>{formatPrice(order.intl_shipping_cost)}</dd>
              </div>
            )}
            {order.local_delivery_cost > 0 && (
              <div className="flex justify-between text-muted">
                <dt>{order.is_pickup ? 'Pickup & handling' : labels.localDeliveryTitle}</dt>
                <dd>{formatPrice(order.local_delivery_cost)}</dd>
              </div>
            )}
            <div className="flex justify-between pt-2 text-lg font-extrabold">
              <dt>Total paid</dt>
              <dd className="text-brand-green">{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </section>

        {order.payment_status === 'pending' && order.status !== 'cancelled' && !cancelled && (
          <section className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              {order.payment_method === 'pod' ? 'Payment on delivery' : 'Complete payment'}
            </h2>
            <CompletePaymentPanel order={order} onPaid={() => refetch()} />
          </section>
        )}

        {(order.wallet_refunded_total > 0 || order.wallet_refunds?.length > 0) && (
          <section className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Wallet refunds</h2>
            <p className="text-sm text-muted">
              Total credited to your wallet:{' '}
              <span className="font-bold text-brand-green">{formatPrice(order.wallet_refunded_total || 0)}</span>
            </p>
            {order.wallet_refunds?.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {order.wallet_refunds.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 border-t border-black/5 pt-2 first:border-0 first:pt-0 dark:border-white/10">
                    <span className="text-muted">{r.note}</span>
                    <span className="font-bold text-brand-green">{formatPrice(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/dashboard/wallet" className="mt-3 inline-block text-sm font-bold text-brand-green hover:underline">
              View wallet →
            </Link>
          </section>
        )}

        {order.pickup_station && (
          <section className="rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 dark:border-brand-green/20 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Pickup station</p>
            <p className="mt-1 font-bold">{order.pickup_station.name}</p>
            <p className="text-sm text-muted">{formatStationAddress(order.pickup_station)}</p>
            {order.pickup_station.hours && (
              <p className="mt-1 text-sm text-muted">Hours: {order.pickup_station.hours}</p>
            )}
            {order.pickup_station.phone && (
              <p className="mt-1 text-sm font-semibold">{order.pickup_station.phone}</p>
            )}
          </section>
        )}

        {order.address && (
          <section className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E] sm:p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Delivered to</h2>
            <p className="font-bold">{order.address.recipient_name}</p>
            <p className="mt-1 text-sm text-muted">
              {order.address.street}, {order.address.city}, {order.address.region}
            </p>
            <p className="mt-1 text-sm text-muted">{order.address.phone}</p>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setCancelError('');
        }}
        onConfirm={handleCancel}
        title="Cancel this order?"
        message={
          <div className="space-y-3 text-left">
            <p className="text-sm text-muted">
              You can only cancel before we start processing. This cannot be undone — only an admin can restore a customer-cancelled order.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Reason (optional)</span>
              <textarea
                className="input-field w-full text-sm"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Ordered by mistake"
              />
            </label>
            {cancelError && <p className="text-sm text-brand-red">{cancelError}</p>}
          </div>
        }
        confirmLabel="Yes, cancel order"
        loading={cancelOrder.isPending}
      />
    </div>
  );
}
