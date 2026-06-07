import { formatPrice } from '../../lib/currency';
import { useAirLabels } from '../../hooks/checkout';

function Line({ label, value, highlight, compact }) {
  return (
    <div className={`flex justify-between ${compact ? 'text-xs' : 'text-sm'} ${highlight ? 'font-bold' : ''}`}>
      <span className={highlight ? '' : 'text-muted'}>{label}</span>
      <span className={highlight ? 'text-brand-green' : ''}>{value}</span>
    </div>
  );
}

export default function ShippingPreview({ quote, isLoading, compact = false }) {
  const labels = useAirLabels();
  if (isLoading) {
    return (
      <div className={`rounded-xl border border-dashed border-brand-green/30 bg-brand-green/5 ${compact ? 'p-2.5' : 'p-4'}`}>
        <p className={`font-medium text-brand-green ${compact ? 'text-xs' : 'text-sm'}`}>Estimating shipping…</p>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className={`rounded-xl border border-black/8 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] ${compact ? 'px-3 py-2' : 'rounded-2xl bg-white p-4 dark:bg-[#1E1E1E]'}`}>
      {!compact && (
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Shipping preview</p>
      )}
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        <Line label="Subtotal" value={formatPrice(quote.subtotal)} compact={compact} />
        {quote.intl_shipping_cost > 0 && (
          <Line label={labels.intlShippingTitle} value={formatPrice(quote.intl_shipping_cost)} compact={compact} />
        )}
        <Line
          label={labels.localDeliveryTitle}
          value={formatPrice(quote.local_delivery_cost)}
          compact={compact}
        />
        {quote.discount_amount > 0 && (
          <Line
            label={quote.discount_label || 'Loyalty discount'}
            value={`−${formatPrice(quote.discount_amount)}`}
            compact={compact}
          />
        )}
        {!compact && <div className="my-2 border-t border-black/5 dark:border-white/10" />}
        <Line label="Total" value={formatPrice(quote.total)} highlight compact={compact} />
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-subtle">Final amount confirmed at checkout.</p>
      )}
    </div>
  );
}
