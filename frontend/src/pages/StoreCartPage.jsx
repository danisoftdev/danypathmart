import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useStoreCartStore } from '../store/storeCartStore';
import { formatPrice } from '../lib/currency';
import EmptyState from '../components/ui/EmptyState';

export default function StoreCartPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { shop } = useOutletContext() ?? {};
  const items = useStoreCartStore((s) => s.items);
  const cartSlug = useStoreCartStore((s) => s.shopSlug);
  const removeItem = useStoreCartStore((s) => s.removeItem);
  const updateQty = useStoreCartStore((s) => s.updateQty);
  const subtotal = useStoreCartStore((s) => s.subtotal);
  const setShop = useStoreCartStore((s) => s.setShop);

  useEffect(() => {
    if (shop?.slug) setShop(shop.slug, shop.name);
  }, [shop?.slug, shop?.name, setShop]);

  if (!items.length || cartSlug !== slug) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="Your cart is empty"
          message="Add products from this shop to checkout."
          actionLabel={shop?.name ? `Browse ${shop.name}` : 'Browse shop'}
          actionTo={`/stores/${slug}`}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <h1 className="text-xl font-extrabold">Your cart</h1>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{item.name}</p>
              <p className="text-sm text-muted">{formatPrice(item.price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => updateQty(item.id, e.target.value)}
                className="w-16 rounded-lg border border-black/10 px-2 py-1 text-center text-sm dark:border-white/15 dark:bg-transparent"
              />
              <button type="button" onClick={() => removeItem(item.id)} className="text-xs font-bold text-brand-red">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-brand-green/10 px-4 py-4">
        <span className="font-bold">Subtotal</span>
        <span className="text-lg font-extrabold text-brand-green">{formatPrice(subtotal())}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to={`/stores/${slug}`} className="min-h-[44px] rounded-xl border-2 border-black/10 px-5 py-2 text-sm font-bold dark:border-white/15">
          Continue shopping
        </Link>
        <button type="button" className="btn-primary min-h-[44px] px-6" onClick={() => navigate(`/stores/${slug}/checkout`)}>
          Checkout
        </button>
      </div>
    </div>
  );
}
