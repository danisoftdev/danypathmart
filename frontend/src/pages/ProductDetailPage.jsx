import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProduct } from '../hooks/catalog';
import ProductGallery from '../components/product/ProductGallery';
import ProductImage from '../components/product/ProductImage';
import ProductRating from '../components/product/ProductRating';
import ProductPurchaseMeta from '../components/product/ProductPurchaseMeta';
import ProductCarouselSection, { FrequentlyBoughtTogether } from '../components/product/ProductCarouselSection';
import SizeGuidePanel from '../components/product/SizeGuidePanel';
import { formatPrice } from '../lib/currency';
import { productDiscount, stockLabel } from '../lib/productUi';
import { addRecentlyViewed } from '../lib/browseStorage';
import { useIsWishlisted, useToggleWishlist } from '../hooks/wishlist';
import { useCartStore } from '../store/cartStore';
import RestockAlertButton from '../components/product/RestockAlertButton';
import CustomProofFields from '../components/product/CustomProofFields';
import EmptyState from '../components/ui/EmptyState';
import { ProductDetailSkeleton } from '../components/ui/Skeleton';
import { CheckCircleIcon } from '../components/icons';

function SpecRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 py-2.5 text-sm last:border-0 dark:border-white/10">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-[#111111] dark:text-white">{value}</span>
    </div>
  );
}

import { useAirLabels } from '../hooks/checkout';
import { ProductBadgesInline } from '../components/product/ProductBadges';
import {
  isShopMarketplaceProduct,
  shopBuyPath,
  shopNameOf,
  shopStorePath,
} from '../lib/marketplaceProduct';

function DetailTabs({ product, labels }) {
  const tabs = [
    { id: 'description', label: 'Description' },
    { id: 'specs', label: 'Specifications' },
    { id: 'shipping', label: 'Shipping' },
  ];
  const [tab, setTab] = useState('description');

  return (
    <section className="mt-10 rounded-2xl border border-black/8 bg-white dark:border-white/10 dark:bg-[#1E1E1E]">
      <div className="flex overflow-x-auto border-b border-black/8 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-5 py-3.5 text-sm font-bold transition ${
              tab === t.id
                ? 'border-b-2 border-brand-green text-brand-green'
                : 'text-muted hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 md:p-6">
        {tab === 'description' && (
          <div className="space-y-6">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted md:text-base">
              {product.description || 'No description available for this product.'}
            </p>
            {product.images?.length > 1 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">More photos</h3>
                <div className="flex flex-wrap gap-2">
                  {product.images.map((img, i) => (
                    <div
                      key={i}
                      className="h-20 w-20 overflow-hidden rounded-lg border border-black/8 bg-[#fafafa] dark:border-white/10 dark:bg-[#252525] sm:h-24 sm:w-24"
                    >
                      <ProductImage
                        src={img}
                        alt={`${product.name} ${i + 1}`}
                        fit="contain"
                        className="h-full w-full p-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'specs' && (
          <div className="rounded-xl bg-[#FFF9F3] p-3 dark:bg-black/20 md:max-w-xl">
            <SpecRow label="Category" value={product.category?.name} />
            <SpecRow label="Origin" value={product.origin_country} />
            <SpecRow label={labels.specLabel} value={product.is_preorder ? 'Yes' : 'No'} />
            <SpecRow label="Stock quantity" value={product.stock_qty} />
            {product.tags?.length > 0 && <SpecRow label="Tags" value={product.tags.join(', ')} />}
          </div>
        )}

        {tab === 'shipping' && (
          <ul className="list-inside list-disc space-y-2 text-sm text-muted md:text-base">
            <li>Local delivery available across Ghana — rates calculated at checkout.</li>
            <li>International delivery (by air) may include longer lead times.</li>
            {product.origin_country && product.is_preorder && (
              <li>Sourced from {product.origin_country} for by-air items.</li>
            )}
            <li>Secure payment via Paystack (card &amp; MTN MoMo).</li>
          </ul>
        )}
      </div>
    </section>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const labels = useAirLabels();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProduct(slug);
  const addItem = useCartStore((s) => s.addItem);
  const updateCustomProof = useCartStore((s) => s.updateCustomProof);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [customProof, setCustomProof] = useState({ label_text: '', file_path: '' });
  const [wishToggled, setWishToggled] = useState(null);
  const wishlisted = useIsWishlisted(data?.data?.id ?? 0);
  const toggleWish = useToggleWishlist();

  // Persist recently viewed (external storage only).
  useEffect(() => {
    if (data?.data) addRecentlyViewed(data.data);
  }, [data?.data?.id]);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (isError || !data?.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Product not found"
          message="This item may have been removed or the link is incorrect."
          actionLabel="Back to shop"
          actionTo="/shop"
        />
      </div>
    );
  }

  const product = data.data;
  const wish = wishToggled ?? wishlisted;
  const images = product.images?.length ? product.images : [null];
  const outOfStock = !product.is_preorder && product.stock_qty <= 0;
  const discount = productDiscount(product);
  const stock = stockLabel(product, labels);
  const marketplace = isShopMarketplaceProduct(product);
  const shopName = shopNameOf(product);

  const handleAdd = () => {
    if (marketplace) return;
    const payload = product.requires_custom_proof
      ? { ...product, custom_proof: customProof }
      : product;
    addItem(payload, qty);
    if (product.requires_custom_proof) {
      updateCustomProof(product.id, customProof);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (marketplace) {
      navigate(shopBuyPath(product));
      return;
    }
    const payload = product.requires_custom_proof
      ? { ...product, custom_proof: customProof }
      : product;
    addItem(payload, qty);
    if (product.requires_custom_proof) {
      updateCustomProof(product.id, customProof);
    }
    navigate('/checkout');
  };

  const categoryId = product.category?.id ?? product.category_id;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-36 pt-4 md:pb-10 md:pt-6">
      <nav className="mb-4 text-sm text-subtle">
        <Link to="/shop" className="hover:text-brand-green">Shop</Link>
        {product.category && (
          <>
            {' / '}
            <Link to={`/shop?category=${product.category.slug}`} className="hover:text-brand-green">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8 lg:items-start">
        <div className="mx-auto w-full max-w-[360px] lg:mx-0">
          <ProductGallery images={images} alt={product.name} />
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <ProductRating product={product} size="md" />
              <button
                type="button"
                aria-label={wish ? 'Remove from wishlist' : 'Add to wishlist'}
                onClick={async () => setWishToggled(await toggleWish(product.id))}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-xl ${
                  wish ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-black/10 dark:border-white/15'
                }`}
              >
                {wish ? '♥' : '♡'}
              </button>
            </div>

            <h1 className="mt-2 text-xl font-extrabold leading-snug text-[#111111] dark:text-white md:text-2xl lg:text-[1.65rem]">
              {product.name}
            </h1>

            {marketplace && (
              <Link
                to={shopStorePath(product)}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-green"
              >
                {product.shop?.logo_url && (
                  <img src={product.shop.logo_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                )}
                Sold by {shopName}
              </Link>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-2 border-b border-black/8 pb-4 dark:border-white/10">
              <span className="text-2xl font-extrabold text-brand-green md:text-3xl">{formatPrice(product.price)}</span>
              {discount && (
                <span className="text-base text-muted line-through md:text-lg">{formatPrice(discount.compareAt)}</span>
              )}
              {discount && (
                <span className="rounded-md bg-brand-red px-2 py-0.5 text-xs font-bold text-white md:text-sm">
                  -{discount.percent}%
                </span>
              )}
              <ProductBadgesInline product={product} />
            </div>

            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-base">🚚</span>
                <div>
                  <p className="font-semibold text-[#111111] dark:text-white">
                    {marketplace ? `Sold & fulfilled by ${shopName}` : 'Delivery across Ghana'}
                  </p>
                  <p className="text-xs text-muted">
                    {marketplace
                      ? 'Checkout on the seller’s shop — they arrange delivery with you.'
                      : 'Local delivery calculated at checkout'}
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-base">📦</span>
                <div>
                  <p className="font-semibold text-[#111111] dark:text-white">Availability</p>
                  <p
                    className={`text-xs font-bold ${
                      stock.tone === 'red' ? 'text-brand-red' : stock.tone === 'gold' ? 'text-brand-gold' : 'text-brand-green'
                    }`}
                  >
                    {stock.text}
                    {!product.is_preorder && product.stock_qty > 0 ? ` (${product.stock_qty} in stock)` : ''}
                  </p>
                  <ProductPurchaseMeta product={product} className="mt-1.5" />
                </div>
              </li>
              {(product.is_preorder || product.estimated_arrival_days) && (
                <li className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-base">✈️</span>
                  <div>
                    <p className="font-semibold text-[#111111] dark:text-white">Estimated arrival</p>
                    <p className="text-xs text-muted">
                      {product.estimated_arrival_days
                        ? `~${product.estimated_arrival_days} days`
                        : product.is_preorder
                          ? 'When stock arrives'
                          : '—'}
                    </p>
                  </div>
                </li>
              )}
              <li className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-base">🔒</span>
                <div>
                  <p className="font-semibold text-[#111111] dark:text-white">Secure checkout</p>
                  <p className="text-xs text-muted">Paystack — card &amp; mobile money</p>
                </div>
              </li>
            </ul>
          </div>

          {product.size_guide && <SizeGuidePanel guide={product.size_guide} />}

          {!marketplace && product.requires_custom_proof && !outOfStock && (
            <CustomProofFields
              productId={product.id}
              productName={product.name}
              value={customProof}
              onChange={setCustomProof}
            />
          )}

          {!marketplace && outOfStock && (
            <div className="mt-4">
              <RestockAlertButton
                productId={product.id}
                productName={product.name}
                tags={product.tags || []}
              />
            </div>
          )}

          {marketplace ? (
            <div className="mt-5 hidden flex-col gap-2 md:flex">
              <Link to={shopBuyPath(product)} className="btn-primary py-3 text-center">
                Buy from {shopName}
              </Link>
              <Link to={shopStorePath(product)} className="btn-secondary py-3 text-center">
                Visit shop
              </Link>
            </div>
          ) : (
            <div className="mt-5 hidden items-center gap-3 md:flex">
              <div className="flex items-center rounded-xl border-2 border-black/10 dark:border-white/15">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="min-h-[44px] min-w-[44px] text-xl">−</button>
                <span className="w-10 text-center font-bold">{qty}</span>
                <button type="button" onClick={() => setQty((q) => q + 1)} className="min-h-[44px] min-w-[44px] text-xl">+</button>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={outOfStock}
                className={`btn-primary flex flex-1 items-center justify-center gap-1.5 py-3 disabled:cursor-not-allowed disabled:opacity-50 ${
                  added ? 'ring-2 ring-brand-green/40' : ''
                }`}
              >
                {added ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    Added!
                  </>
                ) : outOfStock ? (
                  'Out of stock'
                ) : product.is_preorder ? (
                  labels.addToCart
                ) : (
                  'Add to cart'
                )}
              </button>
              <button type="button" onClick={handleBuyNow} disabled={outOfStock} className="btn-secondary flex-1 py-3 disabled:opacity-50">
                Buy now
              </button>
            </div>
          )}
        </div>
      </div>

      <DetailTabs product={product} labels={labels} />

      {!marketplace && <FrequentlyBoughtTogether product={product} categoryId={categoryId} />}

      <ProductCarouselSection
        title="Related products"
        categoryId={categoryId}
        excludeId={product.id}
        viewAllTo={product.category ? `/shop?category=${product.category.slug}` : '/shop'}
      />

      {/* Sticky mobile bar */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-black/8 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-[#1E1E1E]/95 md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          {marketplace ? (
            <Link to={shopBuyPath(product)} className="btn-primary flex-1 py-3.5 text-center">
              Buy from {shopName}
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAdd}
                disabled={outOfStock}
                className={`btn-primary flex flex-1 items-center justify-center gap-1.5 py-3.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                  added ? 'ring-2 ring-brand-green/40' : ''
                }`}
              >
                {added ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    Added!
                  </>
                ) : (
                  'Add to cart'
                )}
              </button>
              <button type="button" onClick={handleBuyNow} disabled={outOfStock} className="btn-secondary flex-1 py-3.5 disabled:opacity-50">
                Buy now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
