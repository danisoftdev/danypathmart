/** Column definitions for admin CSV exports (Phase 3 column picker). */

export const EXPORT_COLUMN_SETS = {
  orders: [
    { key: 'order_id', label: 'Order #', default: true },
    { key: 'created_at', label: 'Date', default: true },
    { key: 'customer_name', label: 'Customer name', default: true },
    { key: 'customer_email', label: 'Customer email', default: true },
    { key: 'organization_name', label: 'Organization', default: true },
    { key: 'order_type', label: 'Order type', default: false },
    { key: 'status', label: 'Status', default: true },
    { key: 'payment_status', label: 'Payment status', default: true },
    { key: 'payment_method', label: 'Payment method', default: true },
    { key: 'subtotal', label: 'Subtotal', default: true },
    { key: 'intl_shipping', label: 'Intl shipping', default: false },
    { key: 'local_delivery', label: 'Local delivery', default: false },
    { key: 'discount', label: 'Discount', default: false },
    { key: 'total', label: 'Total', default: true },
    { key: 'currency', label: 'Currency', default: false },
    { key: 'item_qty', label: 'Item qty', default: true },
  ],
  quotes: [
    { key: 'quote_number', label: 'Quote #', default: true },
    { key: 'organization_name', label: 'Organization', default: true },
    { key: 'contact_name', label: 'Contact name', default: true },
    { key: 'contact_email', label: 'Contact email', default: true },
    { key: 'contact_phone', label: 'Contact phone', default: false },
    { key: 'status', label: 'Status', default: true },
    { key: 'subtotal', label: 'Subtotal', default: true },
    { key: 'intl_shipping', label: 'Intl shipping', default: false },
    { key: 'local_delivery', label: 'Local delivery', default: false },
    { key: 'total', label: 'Total', default: true },
    { key: 'valid_until', label: 'Valid until', default: true },
    { key: 'proforma_sent_at', label: 'Proforma sent', default: false },
    { key: 'converted_order_id', label: 'Order ID', default: false },
    { key: 'account_name', label: 'Account name', default: false },
    { key: 'account_email', label: 'Account email', default: false },
    { key: 'created_at', label: 'Created', default: true },
  ],
  products: [
    { key: 'id', label: 'ID', default: false },
    { key: 'name', label: 'Name', default: true },
    { key: 'slug', label: 'Slug', default: true },
    { key: 'category', label: 'Category', default: true },
    { key: 'price', label: 'Price', default: true },
    { key: 'cost_price', label: 'Cost price', default: true },
    { key: 'compare_at_price', label: 'Compare-at price', default: false },
    { key: 'stock_qty', label: 'Stock qty', default: true },
    { key: 'status', label: 'Status', default: true },
    { key: 'is_preorder', label: 'Pre-order', default: false },
    { key: 'is_featured', label: 'Featured', default: false },
    { key: 'is_flash_deal', label: 'Flash deal', default: false },
    { key: 'origin_country', label: 'Origin country', default: false },
    { key: 'estimated_arrival_days', label: 'Arrival days', default: false },
    { key: 'rating_avg', label: 'Rating', default: false },
    { key: 'rating_count', label: 'Review count', default: false },
    { key: 'badge_label', label: 'Badge', default: false },
    { key: 'tags', label: 'Tags', default: false },
    { key: 'created_at', label: 'Created', default: false },
  ],
};

export function defaultExportColumns(type) {
  const set = EXPORT_COLUMN_SETS[type] || [];
  return set.filter((c) => c.default).map((c) => c.key);
}

export function loadExportColumnPrefs(type) {
  try {
    const raw = localStorage.getItem(`dpm-export-cols-${type}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set((EXPORT_COLUMN_SETS[type] || []).map((c) => c.key));
    const filtered = parsed.filter((k) => allowed.has(k));
    return filtered.length ? filtered : null;
  } catch {
    return null;
  }
}

export function saveExportColumnPrefs(type, keys) {
  localStorage.setItem(`dpm-export-cols-${type}`, JSON.stringify(keys));
}

export function columnsParam(keys) {
  return keys?.length ? keys.join(',') : undefined;
}
