import api from './api';

async function downloadShopCsv(path, params, fallbackName) {
  const res = await api.get(path, {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  a.download = match?.[1] || fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Shop sales summary — one row per order (earnings + delivery status). */
export function downloadShopSalesExport(params = {}) {
  const date = new Date().toISOString().slice(0, 10);
  return downloadShopCsv(
    '/shop/orders/export',
    { view: 'orders', ...params },
    `shop-sales-${date}.csv`
  );
}

/** Shop line items — one row per product sold. */
export function downloadShopSalesItemsExport(params = {}) {
  const date = new Date().toISOString().slice(0, 10);
  return downloadShopCsv(
    '/shop/orders/export',
    { view: 'items', ...params },
    `shop-sales-items-${date}.csv`
  );
}
