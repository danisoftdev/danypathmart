/** Preset shop promo badge labels (Phase M6). */
export const SHOP_BADGE_PRESETS = ['', 'Promo', 'Hot cake', 'New', 'Sale', 'Limited'];

export function shopBadgeOptions() {
  return [
    { value: '', label: 'No badge' },
    ...SHOP_BADGE_PRESETS.filter(Boolean).map((label) => ({ value: label, label })),
    { value: '__custom__', label: 'Custom text…' },
  ];
}

/** @param {import('./productUi').ProductLike} product */
export function productDisplayBadges(product) {
  if (product?.display_badges?.length) {
    return product.display_badges;
  }
  if (product?.shop_id && product?.shop_promo?.display_badges?.length) {
    return product.shop_promo.display_badges;
  }
  if (product?.badge_label) {
    return [product.badge_label];
  }
  return [];
}
