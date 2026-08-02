import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductGallery from './ProductGallery';
import ProductRating from './ProductRating';
import ProductBadges from './ProductBadges';
import { formatPrice } from '../../lib/currency';
import { productDiscount, stockLabel } from '../../lib/productUi';
import { useIsWishlisted, useToggleWishlist } from '../../hooks/wishlist';
import { useCartStore } from '../../store/cartStore';
import { CloseIcon } from '../icons';
import {
  isShopMarketplaceProduct,
  shopBuyPath,
  shopNameOf,
} from '../../lib/marketplaceProduct';

export default function ProductQuickView({ product, onClose }) {
  const addItem = useCartStore((s) => s.addItem);
  const wish = useIsWishlisted(product?.id);
  const toggleWish = useToggleWishlist();
  const outOfStock = product && !product.is_preorder && product.stock_qty <= 0;
  const discount = product ? productDiscount(product) : null;
  const stock = product ? stockLabel(product) : null;
  const images = product?.images?.length ? product.images : [null];
  const marketplace = product ? isShopMarketplaceProduct(product) : false;

  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!product) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [product, close]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={close} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-xl dark:bg-[#1E1E1E] sm:rounded-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="Close quick view"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/10 dark:bg-white/10"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="grid sm:grid-cols-2">
          <div className="relative p-3 sm:p-4">
            <div className="absolute left-5 top-5 z-10 flex flex-col gap-1">
              {discount && (
                <span className="rounded-lg bg-brand-red px-2 py-1 text-xs font-bold text-white">
                  -{discount.percent}%
                </span>
              )}
              <ProductBadges product={product} />
            </div>
            <ProductGallery images={images} alt={product.name} compact />
          </div>

          <div className="border-t border-black/8 p-4 dark:border-white/10 sm:border-l sm:border-t-0">
            <ProductRating product={product} size="md" />
            <h2 className="mt-2 text-lg font-bold text-[#111111] dark:text-white">{product.name}</h2>
            {marketplace && (
              <p className="mt-1 text-sm font-semibold text-muted">Sold by {shopNameOf(product)}</p>
            )}
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-brand-green">{formatPrice(product.price)}</span>
              {discount && <span className="text-sm text-muted line-through">{formatPrice(discount.compareAt)}</span>}
            </div>
            {stock && (
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
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
            )}

            <div className="mt-4 flex gap-2">
              {marketplace ? (
                <Link
                  to={shopBuyPath(product)}
                  onClick={close}
                  className="btn-primary flex-1 py-3 text-center"
                >
                  Buy from {shopNameOf(product)}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => addItem(product, 1)}
                  disabled={outOfStock}
                  className="btn-primary flex-1 py-3 disabled:opacity-50"
                >
                  {outOfStock ? 'Out of stock' : 'Add to cart'}
                </button>
              )}
              <button
                type="button"
                aria-label={wish ? 'Remove from wishlist' : 'Add to wishlist'}
                onClick={async () => toggleWish(product.id)}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 ${
                  wish ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-black/10 dark:border-white/15'
                }`}
              >
                {wish ? '♥' : '♡'}
              </button>
            </div>
            <Link
              to={`/product/${product.slug}`}
              onClick={close}
              className="mt-3 block text-center text-sm font-semibold text-brand-green hover:underline"
            >
              View full details →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
