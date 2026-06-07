/** Customer-facing labels for is_preorder products (Phase M1 — “By air”). */

export function useByAirLabels(byAirEnabled = true) {
  const legacy = !byAirEnabled;
  return {
    badge: legacy ? 'PRE-ORDER' : 'BY AIR',
    badgeShort: legacy ? 'Pre-order' : 'By air',
    stock: legacy ? 'Pre-order' : 'By air',
    filter: legacy ? 'Pre-order' : 'By air',
    filterOnly: legacy ? 'Pre-order only' : 'By air only',
    cartBadge: legacy ? 'PRE-ORDER' : 'BY AIR',
    addToCart: legacy ? 'Pre-order' : 'Order by air',
    orderNotice: legacy
      ? 'Your order includes pre-order items sourced internationally.'
      : 'Your order includes items shipped by air from overseas.',
    intlShippingTitle: 'International delivery',
    intlShippingDetail: 'Shipped by air from overseas suppliers',
    localDeliveryTitle: 'Local delivery & handling',
    specLabel: legacy ? 'Pre-order' : 'By air (international)',
  };
}

export const BY_AIR_LABELS = useByAirLabels(true);
