import { Link } from 'react-router-dom';
import ProductImage from '../product/ProductImage';
import { formatPrice } from '../../lib/currency';
import { productDiscount } from '../../lib/productUi';
import { useCartStore } from '../../store/cartStore';
import { addRecentlyViewed } from '../../lib/browseStorage';

import { useAirLabels } from '../../hooks/checkout';

export default function ProductTile({ product, badge, compact = false }) {
  const addItem = useCartStore((s) => s.addItem);
  const labels = useAirLabels();
  const outOfStock = !product.is_preorder && product.stock_qty <= 0;
  const discount = productDiscount(product);
  const widthClass = compact ? 'w-36' : 'w-40 sm:w-44';
  const displayBadge =
    badge
    || (product.display_badges?.[0])
    || product.badge_label
    || (product.is_preorder ? labels.badge : null);

  const onOpen = () => addRecentlyViewed(product);

  return (
    <article
      className={`${widthClass} shrink-0 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]`}
    >
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
      <div className="p-2.5">
        <Link
          to={`/product/${product.slug}`}
          onClick={onOpen}
          className="line-clamp-2 text-xs font-semibold leading-snug text-[#111111] hover:text-brand-green dark:text-white"
        >
          {product.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-1">
          <p className="text-base font-extrabold text-brand-green">{formatPrice(product.price)}</p>
          {discount && (
            <p className="text-[10px] text-muted line-through">{formatPrice(discount.compareAt)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => addItem(product, 1)}
          disabled={outOfStock}
          className="mt-2 w-full rounded-lg bg-brand-green py-2 text-xs font-bold text-white transition hover:bg-opacity-90 disabled:opacity-50"
        >
          {outOfStock ? 'Sold out' : '+ Cart'}
        </button>
      </div>
    </article>
  );
}
