/** Shop-owned marketplace listing (browse on DPM, buy on shop storefront). */
export function isShopMarketplaceProduct(product) {
  if (!product) return false;
  const shopId = product.shop_id ?? product.shop?.id;
  return shopId != null && Number(shopId) > 0;
}

export function shopSlugOf(product) {
  return (product?.shop?.slug || product?.shop_slug || '').trim();
}

export function shopNameOf(product) {
  return (product?.shop?.name || product?.shop_name || 'shop').trim() || 'shop';
}

/** Deep link into the seller storefront product. */
export function shopBuyPath(product) {
  const slug = shopSlugOf(product);
  if (!slug) return '/stores';
  const id = product?.id;
  return id ? `/stores/${slug}#product-${id}` : `/stores/${slug}`;
}

export function shopStorePath(product) {
  const slug = shopSlugOf(product);
  return slug ? `/stores/${slug}` : '/stores';
}
