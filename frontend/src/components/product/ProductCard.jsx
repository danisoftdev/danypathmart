import { useState } from 'react';
import { Link } from 'react-router-dom';

import ProductImage from './ProductImage';
import ProductBadges from './ProductBadges';
import ProductPurchaseMeta from './ProductPurchaseMeta';
import { CheckCircleIcon } from '../icons';

import { formatPrice } from '../../lib/currency';

import { productDiscount, stockLabel } from '../../lib/productUi';
import { useCatalogSettings } from '../../hooks/catalogSettings';

import { useIsWishlisted, useToggleWishlist } from '../../hooks/wishlist';

import { addRecentlyViewed } from '../../lib/browseStorage';

import { useAirLabels } from '../../hooks/checkout';
import { useCartStore } from '../../store/cartStore';
import { useStoreCartStore } from '../../store/storeCartStore';
import {
  isShopMarketplaceProduct,
  shopBuyPath,
  shopNameOf,
  shopStorePath,
} from '../../lib/marketplaceProduct';

export default function ProductCard({ product, onQuickView, storeMode = false, shopSlug, shopName }) {
  const addItem = useCartStore((s) => s.addItem);
  const addStoreItem = useStoreCartStore((s) => s.addItem);
  const labels = useAirLabels();
  const { data: catalogSettings } = useCatalogSettings();
  const inv = catalogSettings?.inventory;

  const wishlisted = useIsWishlisted(product.id);
  const toggleWish = useToggleWishlist();
  const [added, setAdded] = useState(false);

  const stockQty = Number(product.stock_qty ?? product.stock ?? 0);
  const outOfStock = !product.is_preorder && stockQty <= 0;
  const marketplace = !storeMode && isShopMarketplaceProduct(product);
  const detailTo = storeMode && shopSlug
    ? `/stores/${shopSlug}#product-${product.id}`
    : `/product/${product.slug}`;
  const buyLabel = marketplace
    ? `Buy from ${shopNameOf(product)}`
    : product.is_preorder
      ? labels.addToCart
      : 'Add to cart';

  const discount = productDiscount(product);
  const stock = stockLabel(product, labels, inv);

  const onNavigate = () => addRecentlyViewed(product);

  const handleAddToCart = () => {
    if (outOfStock || marketplace) return;
    if (storeMode) {
      addStoreItem(product, 1, shopSlug, shopName);
    } else {
      addItem(product, 1);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <article
      id={storeMode ? `product-${product.id}` : undefined}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E] ${
        outOfStock ? 'opacity-60 saturate-50' : ''
      }`}
    >
      <div className="relative">
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {discount && (
            <span className="rounded-lg bg-brand-red px-2 py-0.5 text-[10px] font-bold text-white shadow">
              -{discount.percent}%
            </span>
          )}
          <ProductBadges product={product} labels={labels} />
        </div>

        {outOfStock && (
          <span className="absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 rounded-lg bg-black/70 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}

        <button
          type="button"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={async (e) => {
            e.preventDefault();
            await toggleWish(product.id);
          }}
          className={`absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-lg shadow transition hover:scale-105 dark:bg-black/70 ${
            wishlisted ? 'text-brand-gold' : 'text-black/40'
          }`}
        >
          {wishlisted ? '♥' : '♡'}
        </button>

        {outOfStock ? (
          <div className="block overflow-hidden">
            <ProductImage
              src={product.images?.[0]}
              alt={product.name}
              className="aspect-square w-full object-cover"
            />
          </div>
        ) : (
          <Link to={detailTo} onClick={onNavigate} className="block overflow-hidden">
            <ProductImage
              src={product.images?.[0]}
              alt={product.name}
              className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </Link>
        )}

        {onQuickView && !outOfStock && (
          <button
            type="button"
            onClick={() => onQuickView(product)}
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold text-[#111111] opacity-0 shadow transition group-hover:opacity-100 dark:bg-black/80 dark:text-white md:opacity-0 max-md:opacity-100"
          >
            Quick view
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        {outOfStock ? (
          <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-[#111111]/70 dark:text-white/70">
            {product.name}
          </p>
        ) : (
          <Link
            to={detailTo}
            onClick={onNavigate}
            className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-[#111111] hover:text-brand-green dark:text-white"
          >
            {product.name}
          </Link>
        )}

        {(product.shop?.name || marketplace) && !outOfStock && (
          <Link
            to={shopStorePath(product)}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand-green"
          >
            {product.shop?.logo_url && (
              <img src={product.shop.logo_url} alt="" className="h-4 w-4 rounded-full object-cover" />
            )}
            Sold by {shopNameOf(product)}
          </Link>
        )}

        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-extrabold text-brand-green">{formatPrice(product.price)}</span>
          {discount && (
            <span className="text-xs text-muted line-through">{formatPrice(discount.compareAt)}</span>
          )}
        </div>

        <span
          className={`mt-1.5 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${
            stock.tone === 'gold'
              ? 'bg-brand-gold/20 text-[#92400E]'
              : stock.tone === 'red'
                ? 'bg-brand-red/15 text-brand-red'
                : stock.tone === 'orange'
                  ? 'bg-brand-orange/15 text-brand-orange'
                  : 'bg-brand-green/15 text-brand-green'
          }`}
        >
          {stock.text}
        </span>

        <ProductPurchaseMeta product={product} inventorySettings={inv} compact />

        {marketplace ? (
          <Link
            to={outOfStock ? shopStorePath(product) : shopBuyPath(product)}
            className={`mt-3 block w-full rounded-xl py-2.5 text-center text-sm font-bold text-white transition ${
              outOfStock
                ? 'cursor-not-allowed bg-black/30 dark:bg-white/15'
                : 'bg-brand-green hover:bg-opacity-90'
            }`}
            aria-disabled={outOfStock}
            onClick={outOfStock ? (e) => e.preventDefault() : undefined}
          >
            {outOfStock ? 'Out of stock' : buyLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={outOfStock}
            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-black/25 disabled:text-white/70 dark:disabled:bg-white/15 ${
              added
                ? 'bg-brand-green ring-2 ring-brand-green/40'
                : 'bg-brand-green hover:bg-opacity-90'
            }`}
          >
            {added ? (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                Added!
              </>
            ) : outOfStock ? (
              'Out of stock'
            ) : (
              buyLabel
            )}
          </button>
        )}
      </div>
    </article>
  );
}
