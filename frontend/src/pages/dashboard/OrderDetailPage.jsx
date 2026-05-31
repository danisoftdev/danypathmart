import { Link, useParams } from 'react-router-dom';
import { useOrder } from '../../hooks/checkout';
import { formatPrice, resolveImageUrl } from '../../lib/currency';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';

const STEPS = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'payment_confirmed', label: 'Payment Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function Timeline({ tracking, cancelled }) {
  // Map the latest tracking entry for each canonical status.
  const byStatus = {};
  tracking.forEach((t) => {
    byStatus[t.status] = t;
  });

  const reachedIndexes = STEPS.map((s, i) => (byStatus[s.key] ? i : -1)).filter((i) => i >= 0);
  const currentIndex = reachedIndexes.length ? Math.max(...reachedIndexes) : -1;
  const delivered = currentIndex === STEPS.length - 1 && !!byStatus.delivered;

  if (cancelled) {
    const c = tracking.find((t) => t.status === 'cancelled');
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-400/20 dark:bg-red-400/10">
        <p className="font-semibold text-red-700 dark:text-red-300">Order cancelled</p>
        {c?.note && <p className="mt-1 italic text-red-600/80 dark:text-red-300/80">{c.note}</p>}
        {c?.created_at && <p className="mt-1 text-xs text-red-500/70">{formatStamp(c.created_at)}</p>}
      </div>
    );
  }

  return (
    <ol className="relative">
      {STEPS.map((step, i) => {
        const entry = byStatus[step.key];
        const isCompleted = i < currentIndex || (i === currentIndex && delivered);
        const isActive = i === currentIndex && !delivered;
        const isLast = i === STEPS.length - 1;

        let circle;
        if (isCompleted) {
          circle = 'bg-[#2C7A4B] text-white border-2 border-[#2C7A4B]';
        } else if (isActive) {
          circle = 'bg-[#F59E0B] text-black border-2 border-[#F59E0B] animate-pulse';
        } else {
          circle = 'bg-white border-2 border-[#E5E7EB] text-transparent dark:bg-transparent dark:border-white/20';
        }

        const lineSolid = i < currentIndex;

        return (
          <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                className={[
                  'absolute left-[15px] top-8 -bottom-0 w-px',
                  lineSolid ? 'bg-[#2C7A4B]' : 'border-l-2 border-dashed border-[#E5E7EB] dark:border-white/20',
                ].join(' ')}
                aria-hidden
              />
            )}
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${circle}`}>
              {isCompleted ? <CheckIcon /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <div className="pt-1">
              <p className={`text-sm font-semibold ${isActive ? 'text-[#F59E0B]' : isCompleted ? 'text-[#2C7A4B]' : 'text-black/50 dark:text-white/40'}`}>
                {step.label}
              </p>
              {entry?.created_at && (
                <p className="text-xs text-black/50 dark:text-white/50">{formatStamp(entry.created_at)}</p>
              )}
              {entry?.note && (
                <p className="mt-0.5 text-xs italic text-black/60 dark:text-white/60">{entry.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useOrder(id);
  const order = data?.order;

  if (isLoading) {
    return <FormPanelSkeleton sections={2} />;
  }
  if (isError || !order) {
    return (
      <div>
        <p className="text-sm text-brand-red">Could not load this order.</p>
        <Link to="/dashboard" className="mt-3 inline-block text-sm font-semibold text-brand-green hover:underline">
          &larr; Back to orders
        </Link>
      </div>
    );
  }

  const tracking = order.tracking || [];
  const cancelled = order.status === 'cancelled' || tracking.some((t) => t.status === 'cancelled');

  return (
    <div>
      <Link to="/dashboard" className="mb-4 inline-block text-sm font-semibold text-brand-green hover:underline">
        &larr; Back to orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Order #{order.id}</h1>
        {order.has_preorder && (
          <span className="rounded-full bg-brand-gold px-2.5 py-0.5 text-xs font-bold text-black">PRE-ORDER</span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161616]">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Tracking
          </h2>
          <Timeline tracking={tracking} cancelled={cancelled} />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161616]">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Items
            </h2>
            <ul className="space-y-3">
              {(order.items || []).map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-black/5 dark:bg-white/10">
                    {it.image && (
                      <img src={resolveImageUrl(it.image)} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-black/50 dark:text-white/50">Qty {it.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(it.line_total)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1 border-t border-black/5 pt-4 text-sm dark:border-white/10">
              <div className="flex justify-between text-black/60 dark:text-white/60">
                <dt>Subtotal</dt>
                <dd>{formatPrice(order.subtotal)}</dd>
              </div>
              {order.intl_shipping_cost > 0 && (
                <div className="flex justify-between text-black/60 dark:text-white/60">
                  <dt>International shipping</dt>
                  <dd>{formatPrice(order.intl_shipping_cost)}</dd>
                </div>
              )}
              {order.local_delivery_cost > 0 && (
                <div className="flex justify-between text-black/60 dark:text-white/60">
                  <dt>Local delivery</dt>
                  <dd>{formatPrice(order.local_delivery_cost)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </div>

          {order.address && (
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161616]">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                Delivery address
              </h2>
              <p className="text-sm font-medium">{order.address.recipient_name}</p>
              <p className="text-sm text-black/60 dark:text-white/60">
                {order.address.street}, {order.address.city}, {order.address.region}
              </p>
              <p className="text-sm text-black/60 dark:text-white/60">{order.address.phone}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
