import ProductRating from './ProductRating';
import { productRating, purchasedCountLabel } from '../../lib/productUi';

/**
 * Rating + purchase count — shown under the stock / tag row on product cards.
 */
export default function ProductPurchaseMeta({ product, inventorySettings, compact = false, className = '' }) {
  const rating = product ? productRating(product) : null;
  const purchased = product ? purchasedCountLabel(product, inventorySettings) : null;

  if (!rating && !purchased) return null;

  return (
    <div
      className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${compact ? 'text-[10px]' : 'text-xs'} ${className}`}
    >
      {rating && <ProductRating product={product} showCount={!compact} />}
      {rating && purchased && <span className="text-muted" aria-hidden>·</span>}
      {purchased && (
        <span className="font-semibold text-muted">{purchased}</span>
      )}
    </div>
  );
}
