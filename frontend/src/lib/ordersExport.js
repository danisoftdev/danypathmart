import api from './api';
import { columnsParam } from './exportColumns';

async function downloadExport(path, params, fallbackName) {
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

function withColumns(params, columnKeys) {
  const cols = columnsParam(columnKeys);
  return cols ? { ...params, columns: cols } : params;
}

/** Download admin orders CSV using current list filters. */
export async function downloadAdminOrdersExport(params = {}, columnKeys) {
  return downloadExport(
    '/admin/orders/export',
    withColumns(params, columnKeys),
    `orders-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadAdminQuotesExport(status = '', columnKeys) {
  return downloadExport(
    '/admin/quotes/export',
    withColumns(status ? { status } : {}, columnKeys),
    `quotes-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadAdminProductsExport(params = {}, columnKeys) {
  return downloadExport(
    '/admin/products/export',
    withColumns(params, columnKeys),
    `products-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function downloadAdminReportsExport() {
  return downloadExport('/admin/reports/export', {}, `reports-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function downloadAdminProductsImportTemplate() {
  return downloadExport(
    '/admin/products/import-template',
    {},
    'danypathmart-products-import-template.csv'
  );
}

export async function uploadAdminProductsImport(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/admin/products/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function emailAdminOrdersExport({ email, days = 7 } = {}) {
  const { data } = await api.post('/admin/reports/email-export', { email, days });
  return data;
}
