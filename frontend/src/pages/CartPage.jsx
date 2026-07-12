import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductImage from '../components/product/ProductImage';
import EmptyState from '../components/ui/EmptyState';
import CartRecommendations from '../components/cart/CartRecommendations';
import ShippingPreview from '../components/cart/ShippingPreview';
import { formatPrice } from '../lib/currency';
import {
  addSavedForLater,
  getSavedForLater,
  removeSavedForLater,
} from '../lib/savedForLaterStorage';
import { useShippingQuote, useAirLabels } from '../hooks/checkout';
import { useCartStore } from '../store/cartStore';

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2.2l2 12.5a1.5 1.5 0 001.5 1.3h9.3a1.5 1.5 0 001.5-1.2L20 7H5" />
    </svg>
  );
}

function QtyControl({ qty, onDecrease, onIncrease }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border-2 border-black/10 dark:border-white/15">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={onDecrease}
        className="flex h-10 w-10 items-center justify-center text-lg font-bold transition hover:bg-black/5 dark:hover:bg-white/5"
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-bold">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={onIncrease}
        className="flex h-10 w-10 items-center justify-center text-lg font-bold transition hover:bg-black/5 dark:hover:bg-white/5"
      >
        +
      </button>
    </div>
  );
}

function CartItemCard({ item, onSaveForLater, onRemove, onUpdateQty, labels }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-[#1E1E1E]">
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <Link to={`/shop`} className="shrink-0">
          <ProductImage
            src={item.image}
            alt={item.name}
            className="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 font-bold leading-snug">{item.name}</p>
              {item.is_preorder && (
                <span className="mt-1 inline-block rounded-md bg-brand-gold px-2 py-0.5 text-[10px] font-black text-black">
                  {labels.cartBadge}
                </span>
              )}
            </div>
            <p className="shrink-0 text-base font-extrabold text-brand-green">
              {formatPrice(item.price * item.qty)}
            </p>
          </div>
          <p className="mt-1 text-sm text-muted">{formatPrice(item.price)} each</p>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
            <QtyControl
              qty={item.qty}
              onDecrease={() => onUpdateQty(item.id, item.qty - 1)}
              onIncrease={() => onUpdateQty(item.id, item.qty + 1)}
            />
            <button
              type="button"
              onClick={() => onSaveForLater(item)}
              className="text-sm font-semibold text-brand-green hover:underline"
            >
              Save for later
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="text-sm font-semibold text-brand-red hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SavedItemCard({ item, onMoveToCart, onRemove }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white/80 p-3 dark:border-white/10 dark:bg-[#1E1E1E]/80">
      <ProductImage src={item.image} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.name}</p>
        <p className="text-sm font-bold text-brand-green">{formatPrice(item.price)}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <button
          type="button"
          onClick={() => onMoveToCart(item)}
          className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white"
        >
          Move to cart
        </button>
        <button type="button" onClick={() => onRemove(item.id)} className="text-xs font-semibold text-muted hover:text-brand-red">
          Remove
        </button>
      </div>
    </article>
  );
}

export default function CartPage() {
  const navigate = useNavigate();
  const labels = useAirLabels();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const addItem = useCartStore((s) => s.addItem);
  const subtotal = useCartStore((s) => s.subtotal());
  const [saved, setSaved] = useState(() => getSavedForLater());

  const quoteItems = useMemo(
    () => items.map((i) => ({ product_id: i.id, quantity: i.qty })),
    [items]
  );
  const { data: quote, isLoading: quoteLoading } = useShippingQuote(quoteItems, items.length > 0);

  const handleSaveForLater = (item) => {
    addSavedForLater(item);
    removeItem(item.id);
    setSaved(getSavedForLater());
  };

  const handleMoveToCart = (item) => {
    addItem(item, item.qty || 1);
    removeSavedForLater(item.id);
    setSaved(getSavedForLater());
  };

  const handleRemoveSaved = (id) => {
    removeSavedForLater(id);
    setSaved(getSavedForLater());
  };

  if (items.length === 0 && saved.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 pb-24">
        <EmptyState
          icon={CartIcon}
          title="Your cart is empty"
          message="Browse the shop to add groceries and more."
          actionLabel="Go to Shop"
          actionTo="/shop"
        />
        <CartRecommendations />
      </div>
    );
  }

  const itemCount = items.reduce((n, i) => n + i.qty, 0);
  const shopItems = items.filter((i) => i.shop_id);
  const hasShopItems = shopItems.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-32 md:py-8 md:pb-8">
      {hasShopItems && (
        <div className="mb-4 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm">
          <p className="font-bold">Shop products use their own checkout</p>
          <p className="mt-1 text-muted">
            Marketplace items must be bought from the seller&apos;s shop link, not the main DPM cart.
            {shopItems[0]?.shop_name && (
              <>
                {' '}
                <Link to={`/stores/${shopItems[0].shop_slug || ''}`} className="font-bold text-brand-green hover:underline">
                  Go to {shopItems[0].shop_name}
                </Link>
              </>
            )}
          </p>
        </div>
      )}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Shopping cart</h1>
          <p className="mt-1 text-sm text-muted">
            {itemCount} item{itemCount === 1 ? '' : 's'} ready for checkout
          </p>
        </div>
        <Link to="/shop" className="hidden text-sm font-bold text-brand-green hover:underline sm:inline">
          ← Continue shopping
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  labels={labels}
                  onSaveForLater={handleSaveForLater}
                  onRemove={removeItem}
                  onUpdateQty={updateQty}
                />
              ))}
            </div>
          )}

          {items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-muted dark:border-white/15">
              Cart is empty. Move saved items back or{' '}
              <Link to="/shop" className="font-bold text-brand-green hover:underline">shop more</Link>.
            </p>
          )}

          {saved.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-extrabold">Saved for later ({saved.length})</h2>
              <div className="space-y-2">
                {saved.map((item) => (
                  <SavedItemCard
                    key={item.id}
                    item={item}
                    onMoveToCart={handleMoveToCart}
                    onRemove={handleRemoveSaved}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="lg:hidden">
            <ShippingPreview quote={quote} isLoading={quoteLoading} />
          </div>

          <CartRecommendations />
        </div>

        <aside className="space-y-4">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E]">
              <h2 className="text-lg font-extrabold">Order summary</h2>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Subtotal ({itemCount} items)</span>
                  <span className="font-bold">{formatPrice(subtotal)}</span>
                </div>
                {quote && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Delivery &amp; handling</span>
                      <span className="font-medium">
                        {formatPrice(quote.intl_shipping_cost + quote.local_delivery_cost)}
                      </span>
                    </div>
                    <div className="border-t border-black/5 pt-3 dark:border-white/10">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold">Estimated total</span>
                        <span className="text-2xl font-extrabold text-brand-green">
                          {formatPrice(quote?.total ?? subtotal)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                disabled={items.length === 0 || hasShopItems}
                className="btn-primary mt-5 min-h-[48px] w-full text-base disabled:opacity-50"
              >
                Checkout ({itemCount})
              </button>
              <p className="mt-3 text-center text-xs text-subtle">Secure checkout · Paystack</p>
            </div>

            <div className="hidden lg:block">
              <ShippingPreview quote={quote} isLoading={quoteLoading} />
            </div>
          </div>
        </aside>
      </div>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-black/10 bg-white/95 p-3 backdrop-blur-md dark:border-white/10 dark:bg-[#121212]/95 md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Estimated total</p>
              <p className="text-lg font-extrabold text-brand-green">
                {formatPrice(quote?.total ?? subtotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              disabled={items.length === 0 || hasShopItems}
              className="btn-primary shrink-0 px-6 py-3"
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
