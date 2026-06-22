import ProductImage from '../product/ProductImage';
import { formatPrice } from '../../lib/currency';
import { useCheckoutPolicies, useAirLabels } from '../../hooks/checkout';
import CheckoutLegalNotice from './CheckoutLegalNotice';

function ShippingCard({ icon, title, amount, detail }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
      </div>
      <span className="shrink-0 font-bold">{amount}</span>
    </div>
  );
}

export default function OrderSummary({ items, quote, isLoading, onBack, onContinue, groupOrder = false, pickupMode = false, pickupStation = null }) {
  const { data: policies } = useCheckoutPolicies();
  const labels = useAirLabels();
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-extrabold">Order summary</h2>
        <p className="mt-1 text-sm text-muted">
          {pickupMode ? 'Review items and pickup details before payment.' : 'Review items and shipping before payment.'}
        </p>
      </div>

      {pickupMode && pickupStation && (
        <div className="mb-4 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Pickup at</p>
          <p className="mt-1 font-bold">{pickupStation.name}</p>
          <p className="text-muted">{pickupStation.city}, {pickupStation.region}</p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li
            key={item.key ?? `${item.id}-${idx}`}
            className="flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#1E1E1E]"
          >
            <ProductImage
              src={item.image}
              alt={item.name}
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-bold leading-snug">{item.name}</p>
              {groupOrder && (item.recipient_name || item.size_label) && (
                <p className="mt-0.5 text-xs font-semibold text-brand-green">
                  {[item.recipient_name, item.size_label && `Size ${item.size_label}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <p className="mt-0.5 text-sm text-muted">
                Qty {item.qty} × {formatPrice(item.price)}
                {item.shop_name && (
                  <span className="ml-2 rounded bg-brand-green/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-green">
                    {item.shop_name}
                  </span>
                )}
                {item.is_preorder && (
                  <span className="ml-2 rounded bg-brand-gold px-1.5 py-0.5 text-[10px] font-black text-black">
                    {labels.cartBadge}
                  </span>
                )}
              </p>
            </div>
            <span className="shrink-0 font-extrabold">{formatPrice(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="my-6 border-t border-black/5 dark:border-white/10" />

      {isLoading || !quote ? (
        <div className="rounded-2xl border border-dashed border-brand-green/30 bg-brand-green/5 p-6 text-center">
          <p className="font-semibold text-brand-green">Calculating shipping…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quote.has_shop_items && quote.has_dpm_items ? (
            <>
              <ShippingCard icon="🏪" title="DanyPathMart items" amount={formatPrice(quote.dpm_subtotal ?? 0)} />
              <ShippingCard icon="🛍️" title="Marketplace shop items" amount={formatPrice(quote.shop_subtotal ?? 0)} />
              <ShippingCard icon="📋" title="Combined subtotal" amount={formatPrice(quote.subtotal)} />
            </>
          ) : (
            <ShippingCard icon="🛍️" title="Subtotal" amount={formatPrice(quote.subtotal)} />
          )}

          {quote.shop_delivery_note && (
            <div className="rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-4 text-sm">
              <p className="font-bold">Shop delivery</p>
              <p className="mt-1 text-muted">{quote.shop_delivery_note}</p>
            </div>
          )}

          {quote.intl_shipping_cost > 0 && (
            <ShippingCard
              icon="✈️"
              title={labels.intlShippingTitle}
              amount={formatPrice(quote.intl_shipping_cost)}
              detail={labels.intlShippingDetail}
            />
          )}
          <ShippingCard
            icon={pickupMode ? '📍' : '🚚'}
            title={pickupMode ? 'Pickup & handling' : labels.localDeliveryTitle}
            amount={formatPrice(quote.local_delivery_cost)}
            detail={
              pickupMode
                ? (quote.local_delivery_cost > 0 ? 'Station handling fee' : 'No handling fee')
                : (quote.local_delivery_percent > 0 ? `${quote.local_delivery_percent}% of subtotal` : undefined)
            }
          />

          {quote.discount_amount > 0 && (
            <ShippingCard
              icon="🎉"
              title={quote.discount_label || 'Loyalty discount'}
              amount={`−${formatPrice(quote.discount_amount)}`}
              detail="Repeat club order benefit"
            />
          )}

          <div className="rounded-2xl bg-gradient-to-br from-brand-green to-[#1a5c38] p-5 text-white">
            <p className="text-sm font-medium text-white/80">Total due at payment</p>
            <p className="mt-1 text-3xl font-extrabold">{formatPrice(quote.total)}</p>
            <p className="mt-2 text-xs text-white/70">Charged in Ghana Cedis (GHS) via Paystack</p>
          </div>

          {policies?.exchange_summary && (
            <div className="rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-4 text-sm">
              <p className="font-bold text-[#111111] dark:text-white">Sizing &amp; exchanges</p>
              <p className="mt-1 text-muted">{policies.exchange_summary}</p>
            </div>
          )}

          <CheckoutLegalNotice policies={policies} />
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[48px] rounded-xl border-2 border-black/10 px-6 font-bold dark:border-white/15"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={isLoading || !quote}
          onClick={onContinue}
          className="btn-primary min-h-[48px] px-8"
        >
          Continue to payment
        </button>
      </div>
    </div>
  );
}
