import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useKit } from '../hooks/catalog';
import { useCartStore } from '../store/cartStore';
import EmptyState from '../components/ui/EmptyState';
import ProductImage from '../components/product/ProductImage';
import { formatPrice } from '../lib/currency';
import { resolveProductImageUrl } from '../lib/productImages';
import { stockLabel } from '../lib/productUi';
import { ProductDetailSkeleton } from '../components/ui/Skeleton';

function canAddProduct(product) {
  if (!product) return false;
  if (product.is_preorder) return true;
  return product.stock_qty > 0;
}

export default function KitBuilderPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: kit, isLoading, isError } = useKit(slug);
  const addItems = useCartStore((s) => s.addItems);
  const [owned, setOwned] = useState({});
  const [added, setAdded] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');

  const items = kit?.items ?? [];

  const toBuy = useMemo(
    () => items.filter((row) => !owned[row.product_id] && canAddProduct(row.product)),
    [items, owned]
  );

  const skipped = useMemo(
    () => items.filter((row) => owned[row.product_id]),
    [items, owned]
  );

  const unavailable = useMemo(
    () => items.filter((row) => !owned[row.product_id] && !canAddProduct(row.product)),
    [items, owned]
  );

  const subtotal = useMemo(
    () => toBuy.reduce((sum, row) => sum + (Number(row.product?.price) || 0), 0),
    [toBuy]
  );

  const toggleOwned = (productId) => {
    setOwned((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMsg('Link copied!');
      setTimeout(() => setCopyMsg(''), 2500);
    } catch {
      setCopyMsg('Copy failed');
    }
  };

  const addToCart = () => {
    const products = toBuy.map((row) => ({
      id: row.product.id,
      name: row.label || row.product.name,
      price: row.product.price,
      images: row.product.images,
      is_preorder: row.product.is_preorder,
      qty: 1,
    }));
    addItems(products);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ProductDetailSkeleton />
      </div>
    );
  }

  if (isError || !kit) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Kit not found"
          message="This kit may be unpublished or the link is incorrect."
          actionLabel="Browse kits"
          actionTo="/kits"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-32 md:pb-10">
      <nav className="mb-4 text-sm text-subtle">
        <Link to="/" className="hover:text-brand-green">Home</Link>
        {' / '}
        <Link to="/kits" className="hover:text-brand-green">Kits</Link>
        {' / '}
        <span>{kit.name}</span>
      </nav>

      {kit.image_url && (
        <img src={resolveProductImageUrl(kit.image_url)} alt="" className="mb-4 aspect-[21/9] w-full rounded-2xl object-cover" />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">{kit.name}</h1>
          {kit.description && <p className="mt-2 text-sm leading-relaxed text-muted">{kit.description}</p>}
        </div>
        <button type="button" onClick={copyLink} className="btn-ghost shrink-0 px-4 py-2 text-sm">
          {copyMsg || 'Copy share link'}
        </button>
      </div>

      {kit.leader_note && (
        <div className="mt-4 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-4 text-sm text-muted">
          <p className="font-bold text-[#111111] dark:text-white">For leaders</p>
          <p className="mt-1 whitespace-pre-line">{kit.leader_note}</p>
        </div>
      )}

      <section className="mt-8" aria-labelledby="kit-checklist-heading">
        <h2 id="kit-checklist-heading" className="text-lg font-extrabold">Your checklist</h2>
        <p className="mt-1 text-sm text-muted">Tick &ldquo;Already have&rdquo; for items you don&apos;t need to buy.</p>

        <ul className="mt-4 space-y-3">
          {items.map((row) => {
            const p = row.product;
            const stock = stockLabel(p);
            const isOwned = !!owned[row.product_id];
            const addable = canAddProduct(p);

            return (
              <li
                key={row.id}
                className={`rounded-2xl border p-4 transition ${
                  isOwned
                    ? 'border-black/5 bg-black/[0.02] opacity-75 dark:border-white/5 dark:bg-white/[0.02]'
                    : 'border-black/8 bg-white dark:border-white/10 dark:bg-[#1E1E1E]'
                }`}
              >
                <div className="flex gap-3">
                  <ProductImage src={p?.images?.[0]} alt={row.label} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold leading-snug">{row.label}</p>
                      {row.is_required && (
                        <span className="rounded bg-brand-green/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-brand-green">
                          Required
                        </span>
                      )}
                      {!row.is_required && (
                        <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-muted dark:bg-white/10">
                          Optional
                        </span>
                      )}
                    </div>
                    {row.note && <p className="mt-0.5 text-xs text-muted">{row.note}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-extrabold text-brand-green">{formatPrice(p?.price)}</span>
                      <span className={`text-xs font-semibold ${stock.tone === 'red' ? 'text-brand-red' : 'text-muted'}`}>
                        {stock.text}
                      </span>
                      {p?.slug && (
                        <Link to={`/product/${p.slug}`} className="text-xs font-bold text-brand-green hover:underline">
                          View product
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-black/8 px-3 py-2.5 text-sm font-medium dark:border-white/10">
                  <input
                    type="checkbox"
                    checked={isOwned}
                    onChange={() => toggleOwned(row.product_id)}
                    className="h-4 w-4 accent-brand-green"
                  />
                  Already have this
                </label>

                {!isOwned && !addable && (
                  <p className="mt-2 text-xs text-brand-red">Currently unavailable — check the product page or ask support.</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8 rounded-2xl bg-gradient-to-br from-brand-green to-[#1a5c38] p-5 text-white">
        <p className="text-sm text-white/80">
          {toBuy.length} item{toBuy.length === 1 ? '' : 's'} to add
          {skipped.length > 0 ? ` · ${skipped.length} already owned` : ''}
        </p>
        <p className="mt-1 text-3xl font-extrabold">{formatPrice(subtotal)}</p>
        {unavailable.length > 0 && (
          <p className="mt-2 text-xs text-white/70">{unavailable.length} unavailable item(s) excluded.</p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={toBuy.length === 0}
            onClick={addToCart}
            className="btn-primary min-h-[48px] flex-1 bg-white text-brand-green hover:bg-white/90 disabled:opacity-50"
          >
            {added ? 'Added to cart!' : 'Add remaining to cart'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="min-h-[48px] rounded-xl border-2 border-white/30 px-6 font-bold text-white"
          >
            View cart
          </button>
        </div>
      </div>
    </div>
  );
}
