import { BY_AIR_LABELS } from './airLabels';

/** Admin-managed product display helpers (no fake UI data). */

export function productDiscount(product) {
  const compare = Number(product?.compare_at_price) || 0;
  const price = Number(product?.price) || 0;
  if (compare > price) {
    return {
      percent: Math.round((1 - price / compare) * 100),
      compareAt: compare,
    };
  }
  return null;
}

export function productRating(product) {
  const rating = product?.rating_avg != null ? Number(product.rating_avg) : null;
  const reviews = Number(product?.rating_count) || 0;
  if (rating == null || rating <= 0) return null;
  return { rating: Math.min(rating, 5), reviews };
}

export function stockLabel(product, labels = BY_AIR_LABELS) {
  if (product.is_preorder) return { text: labels.stock, tone: 'gold' };
  if (product.stock_qty <= 0) return { text: 'Out of stock', tone: 'red' };
  if (product.stock_qty <= 10) return { text: `Only ${product.stock_qty} left`, tone: 'orange' };
  return { text: 'In stock', tone: 'green' };
}
