import { Link, useParams } from 'react-router-dom';
import ProductImage from '../components/product/ProductImage';
import { formatPrice } from '../lib/currency';
import { useOrder } from '../hooks/checkout';

function StatusBadge({ paid }) {
  return (
    <span
      className={[
        'rounded-full px-3 py-1 text-xs font-semibold',
        paid ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-gold/20 text-amber-700',
      ].join(' ')}
    >
      {paid ? 'Paid' : 'Awaiting payment'}
    </span>
  );
}

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useOrder(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-brand-green">
        Loading your order...
      </div>
    );
  }
  if (isError || !data?.order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <Link to="/shop" className="mt-4 inline-block text-brand-green hover:underline">
          Back to shop
        </Link>
      </div>
    );
  }

  const order = data.order;
  const paid = order.payment_status === 'paid';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-2xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-[#1c1c1c]">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10 text-3xl text-brand-green">
            {'\u2713'}
          </div>
          <h1 className="text-2xl font-bold">Thank you for your order!</h1>
          <p className="mt-1 text-black/60 dark:text-white/60">
            Order <span className="font-semibold">#{order.id}</span>
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <StatusBadge paid={paid} />
            <span className="text-xs text-black/50 dark:text-white/50 capitalize">{order.status}</span>
          </div>
        </div>

        {order.has_preorder && (
          <div className="mt-6 rounded-xl bg-brand-gold/15 p-4 text-sm text-amber-800 dark:text-amber-300">
            Your order includes pre-order items sourced internationally. Estimated arrival dates are
            shown per item below.
          </div>
        )}

        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Items
          </h2>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <ProductImage
                  src={item.image}
                  alt={item.name}
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    {item.quantity} &times; {formatPrice(item.unit_price)}
                    {item.is_preorder && item.estimated_arrival && (
                      <span className="ml-2 text-brand-gold">ETA {item.estimated_arrival}</span>
                    )}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatPrice(item.line_total)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">International shipping</span>
            <span>{formatPrice(order.intl_shipping_cost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">
              Local delivery ({order.local_delivery_percent}%)
            </span>
            <span>{formatPrice(order.local_delivery_cost)}</span>
          </div>
          <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold dark:border-white/10">
            <span>Total paid</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {order.address && (
          <div className="mt-6 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
            <p className="font-medium">{order.address.recipient_name}</p>
            <p className="text-black/60 dark:text-white/60">
              {order.address.street}, {order.address.city}, {order.address.region}
              {order.address.landmark ? ` (${order.address.landmark})` : ''}
            </p>
            <p className="text-black/60 dark:text-white/60">{order.address.phone}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="flex-1 rounded-lg bg-brand-green px-4 py-3 text-center font-semibold text-white transition hover:bg-opacity-90"
          >
            Track Order
          </Link>
          <Link
            to="/shop"
            className="flex-1 rounded-lg border border-black/15 px-4 py-3 text-center font-medium dark:border-white/15"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
