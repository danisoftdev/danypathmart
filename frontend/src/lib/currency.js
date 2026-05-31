// Currency symbols use unicode escapes to keep this source file pure ASCII.
const SYMBOLS = {
  GHS: 'GH\u20B5', // Ghana cedi
  USD: '$',
  NGN: '\u20A6', // naira
  EUR: '\u20AC',
  GBP: '\u00A3',
};

/**
 * Format a price for display. Live FX conversion arrives on Day 5; for now
 * amounts are stored and shown in GHS.
 */
export function formatPrice(amount, currency = 'GHS') {
  const value = Number(amount) || 0;
  const symbol = SYMBOLS[currency] || `${currency} `;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function resolveImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
