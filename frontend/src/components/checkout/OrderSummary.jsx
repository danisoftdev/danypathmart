import ProductImage from '../product/ProductImage';
import { formatPrice } from '../../lib/currency';

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-bold' : 'text-sm'}`}>
      <span className={strong ? '' : 'text-black/60 dark:text-white/60'}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function OrderSummary({ items, quote, isLoading, onBack, onContinue }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Order summary</h2>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <ProductImage
              src={item.image}
              alt={item.name}
              className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-black/60 dark:text-white/60">
                {item.qty} &times; {formatPrice(item.price)}
                {item.is_preorder && (
                  <span className="ml-2 font-semibold text-brand-gold">PRE-ORDER</span>
                )}
              </p>
            </div>
            <span className="text-sm font-semibold">{formatPrice(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="my-5 border-t border-black/10 dark:border-white/10" />

      {isLoading || !quote ? (
        <p className="text-sm text-black/60 dark:text-white/60">Calculating shipping...</p>
      ) : (
        <div className="space-y-2">
          <Row label="Subtotal" value={formatPrice(quote.subtotal)} />
          <Row label="International shipping" value={formatPrice(quote.intl_shipping_cost)} />
          <Row
            label={`Local delivery (${quote.local_delivery_percent}%)`}
            value={formatPrice(quote.local_delivery_cost)}
          />
          <div className="my-2 border-t border-black/10 dark:border-white/10" />
          <Row label="Total" value={formatPrice(quote.total)} strong />
          <p className="pt-1 text-xs text-black/50 dark:text-white/50">
            You will be charged {formatPrice(quote.total)} in Ghana Cedis (GHS).
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-black/15 px-5 py-2.5 font-medium dark:border-white/15"
        >
          Back
        </button>
        <button
          type="button"
          disabled={isLoading || !quote}
          onClick={onContinue}
          className="rounded-lg bg-brand-green px-6 py-2.5 font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50"
        >
          Continue to payment
        </button>
      </div>
    </div>
  );
}
