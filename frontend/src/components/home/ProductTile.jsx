import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProductImage from '../product/ProductImage';
import ProductPurchaseMeta from '../product/ProductPurchaseMeta';
import { CheckCircleIcon } from '../icons';
import { formatPrice } from '../../lib/currency';
import { productDiscount, stockLabel } from '../../lib/productUi';
import { useCatalogSettings } from '../../hooks/catalogSettings';
import { useCartStore } from '../../store/cartStore';
import { addRecentlyViewed } from '../../lib/browseStorage';
import { useAirLabels } from '../../hooks/checkout';
import {
  isShopMarketplaceProduct,
  shopBuyPath,
  shopNameOf,
} from '../../lib/marketplaceProduct';

export default function ProductTile({ product, badge, compact = false }) {
  const addItem = useCartStore((s) => s.addItem);
  const labels = useAirLabels();
  const { data: catalogSettings } = useCatalogSettings();
  const inv = catalogSettings?.inventory;
  const [added, setAdded] = useState(false);

  const outOfStock = !product.is_preorder && product.stock_qty <= 0;
  const discount = productDiscount(product);
  const stock = stockLabel(product, labels, inv);
  const widthClass = compact ? 'w-36' : 'w-40 sm:w-44';
  const marketplace = isShopMarketplaceProduct(product);
  const displayBadge =
    badge
    || (product.display_badges?.[0])
    || product.badge_label
    || (product.is_preorder ? labels.badge : null);

  const onOpen = () => addRecentlyViewed(product);

  const handleAdd = () => {
    if (outOfStock || marketplace) return;
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <article
      className={`${widthClass} shrink-0 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E] ${
        outOfStock ? 'opacity-60 saturate-50' : ''
      }`}
    >
      {outOfStock ? (
        <div className="relative block">
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            {discount && (
              <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold text-white">
                -{discount.percent}%
              </span>
            )}
            {displayBadge && (
              <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-black">
                {displayBadge}
              </span>
            )}
          </div>
          <span className="absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 rounded-lg bg-black/70 px-2 py-0.5 text-center text-[9px] font-bold uppercase text-white">
            Out of stock
          </span>
          <ProductImage
            src={product.images?.[0]}
            alt={product.name}
            className="aspect-square w-full object-cover"
          />
        </div>
      ) : (
        <Link to={`/product/${product.slug}`} onClick={onOpen} className="relative block">
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            {discount && (
              <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold text-white">
                -{discount.percent}%
              </span>
            )}
            {displayBadge && (
              <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-black">
                {displayBadge}
              </span>
            )}
          </div>
          <ProductImage
            src={product.images?.[0]}
            alt={product.name}
            className="aspect-square w-full object-cover"
          />
        </Link>
      )}

      <div className="p-2.5">
        {outOfStock ? (
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-[#111111]/70 dark:text-white/70">
            {product.name}
          </p>
        ) : (
          <Link
            to={`/product/${product.slug}`}
            onClick={onOpen}
            className="line-clamp-2 text-xs font-semibold leading-snug text-[#111111] hover:text-brand-green dark:text-white"
          >
            {product.name}
          </Link>
        )}

        {marketplace && !outOfStock && (
          <p className="mt-0.5 truncate text-[10px] font-semibold text-muted">
            Sold by {shopNameOf(product)}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-baseline gap-1">
          <p className="text-base font-extrabold text-brand-green">{formatPrice(product.price)}</p>
          {discount && (
            <p className="text-[10px] text-muted line-through">{formatPrice(discount.compareAt)}</p>
          )}
        </div>

        <span
          className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
            stock.tone === 'red'
              ? 'bg-brand-red/15 text-brand-red'
              : stock.tone === 'gold'
                ? 'bg-brand-gold/20 text-[#92400E]'
                : 'bg-brand-green/15 text-brand-green'
          }`}
        >
          {stock.text}
        </span>

        <ProductPurchaseMeta product={product} inventorySettings={inv} compact />

        {marketplace ? (
          <Link
            to={shopBuyPath(product)}
            className={`mt-2 block w-full rounded-lg py-2 text-center text-xs font-bold text-white ${
              outOfStock ? 'pointer-events-none bg-black/30' : 'bg-brand-green hover:bg-opacity-90'
            }`}
            onClick={outOfStock ? (e) => e.preventDefault() : undefined}
          >
            {outOfStock ? 'Out of stock' : 'Buy at shop'}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className={`mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:bg-black/25 dark:disabled:bg-white/15 ${
              added ? 'bg-brand-green ring-2 ring-brand-green/40' : 'bg-brand-green hover:bg-opacity-90'
            }`}
          >
            {added ? (
              <>
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Added
              </>
            ) : outOfStock ? (
              'Sold out'
            ) : (
              '+ Cart'
            )}
          </button>
        )}
      </div>
    </article>
  );
}
