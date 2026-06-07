// Storefront prices and payments are Ghana Cedis (GHS) only.

const GHS_SYMBOL = 'GH\u20B5';

/** Format a GHS amount for display. */
export function formatPrice(amount) {
  const value = Number(amount) || 0;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${GHS_SYMBOL}${formatted}`;
}

export function resolveImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
