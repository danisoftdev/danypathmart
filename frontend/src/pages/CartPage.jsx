import { Link, useNavigate } from 'react-router-dom';
import ProductImage from '../components/product/ProductImage';
import { formatPrice } from '../lib/currency';
import { useCartStore } from '../store/cartStore';

export default function CartPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const subtotal = useCartStore((s) => s.subtotal());

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-black/60 dark:text-white/60">
          Browse the shop to add uniforms, badges and more.
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-block rounded-lg bg-brand-green px-5 py-2.5 font-semibold text-white transition hover:bg-opacity-90"
        >
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Your Cart</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-4 rounded-xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#1c1c1c]"
            >
              <ProductImage
                src={item.image}
                alt={item.name}
                className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{item.name}</p>
                  {item.is_preorder && (
                    <span className="rounded-full bg-brand-gold px-2 py-0.5 text-xs font-bold text-black">
                      PRE-ORDER
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-brand-green">{formatPrice(item.price)}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="inline-flex items-center rounded-lg border border-black/10 dark:border-white/15">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      className="px-3 py-1 text-lg leading-none"
                    >
                      &minus;
                    </button>
                    <span className="min-w-8 text-center text-sm">{item.qty}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      className="px-3 py-1 text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="text-right font-semibold">{formatPrice(item.price * item.qty)}</div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1c1c1c]">
          <h2 className="text-lg font-semibold">Order Summary</h2>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Shipping &amp; delivery are calculated at checkout.
          </p>
          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="mt-5 w-full rounded-lg bg-brand-green px-4 py-3 font-semibold text-white transition hover:bg-opacity-90"
          >
            Proceed to Checkout
          </button>
          <Link
            to="/shop"
            className="mt-3 block text-center text-sm text-brand-green hover:underline"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
