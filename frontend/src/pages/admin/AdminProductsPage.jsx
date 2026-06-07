import { useMemo, useState } from 'react';
import { useAdminProducts, useCreateAdminProduct, useDeleteAdminProduct, useFlashSaleSettings, useUpdateAdminProduct, useUpdateFlashSaleSettings } from '../../hooks/admin';
import { useCategories } from '../../hooks/catalog';
import { flattenCategories } from '../../lib/categories';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminFilterBar, { AdminFilterSelect } from '../../components/admin/AdminFilterBar';
import ProductImage from '../../components/product/ProductImage';
import ProductImagesField from '../../components/admin/ProductImagesField';
import { formatPrice } from '../../lib/currency';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { ProductGridSkeleton } from '../../components/ui/Skeleton';
import { downloadAdminProductsExport, downloadAdminProductsImportTemplate, uploadAdminProductsImport } from '../../lib/ordersExport';
import ExportColumnModal from '../../components/admin/ExportColumnModal';
import { useQueryClient } from '@tanstack/react-query';

const EMPTY_DRAFT = {
  name: '',
  price: '',
  cost_price: '',
  compare_at_price: '',
  rating_avg: '',
  rating_count: '',
  badge_label: '',
  stock_qty: '0',
  category_id: '',
  status: 'active',
  is_preorder: false,
  requires_custom_proof: false,
  is_featured: false,
  is_flash_deal: false,
  origin_country: '',
  tags: '',
  images: [],
};

function tagsToArray(raw) {
  return String(raw || '').split(',').map((t) => t.trim()).filter(Boolean);
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  return normalized.slice(0, 16);
}

const EMPTY_PROMO = {
  name: '',
  price: '',
  compare_at_price: '',
  badge_label: 'Deal',
  stock_qty: '10',
  category_id: '',
  status: 'active',
  images: [],
};

function FlashDealProducts({ categoryOptions, payloadFrom, createProduct, updateProduct }) {
  const { data: flashProducts = [], isLoading } = useAdminProducts({ is_flash_deal: '1' });
  const [addSearch, setAddSearch] = useState('');
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [promoDraft, setPromoDraft] = useState(EMPTY_PROMO);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  const searchTerm = addSearch.trim();
  const { data: searchResults = [] } = useAdminProducts(
    { search: searchTerm || undefined, status: 'active' },
    { enabled: showAddExisting && searchTerm.length >= 2 }
  );

  const flashIds = useMemo(() => new Set(flashProducts.map((p) => p.id)), [flashProducts]);
  const pickCandidates = useMemo(
    () => searchResults.filter((p) => !flashIds.has(p.id)).slice(0, 8),
    [searchResults, flashIds]
  );

  const notify = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const addExisting = async (product) => {
    setErr('');
    setBusyId(product.id);
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        is_flash_deal: true,
        badge_label: product.badge_label || 'Deal',
      });
      notify(`"${product.name}" added to flash deals.`);
      setAddSearch('');
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not add product.');
    } finally {
      setBusyId(null);
    }
  };

  const removeFromFlash = async (product) => {
    setErr('');
    setBusyId(product.id);
    try {
      await updateProduct.mutateAsync({ id: product.id, is_flash_deal: false });
      notify(`"${product.name}" removed from flash deals.`);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not update product.');
    } finally {
      setBusyId(null);
    }
  };

  const saveNewPromo = async (e) => {
    e.preventDefault();
    setErr('');
    if (!promoDraft.name.trim()) return setErr('Product name is required.');
    if (!promoDraft.price) return setErr('Promo price is required.');
    try {
      await createProduct.mutateAsync(
        payloadFrom({
          ...promoDraft,
          is_flash_deal: true,
          is_featured: false,
          is_preorder: false,
          cost_price: '',
          rating_avg: '',
          rating_count: '',
          origin_country: '',
          tags: '',
        })
      );
      setPromoDraft(EMPTY_PROMO);
      setShowAddNew(false);
      notify('Promo product added to flash deals.');
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not create promo product.');
    }
  };

  return (
    <div className="mt-4 border-t border-black/8 pt-4 dark:border-white/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Promo products in this section</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setShowAddExisting((v) => !v); setShowAddNew(false); }}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            {showAddExisting ? 'Cancel' : '+ Add existing'}
          </button>
          <button
            type="button"
            onClick={() => { setShowAddNew((v) => !v); setShowAddExisting(false); }}
            className="btn-primary px-3 py-1.5 text-xs"
          >
            {showAddNew ? 'Cancel' : '+ Add new promo'}
          </button>
        </div>
      </div>

      {msg && <p className="mb-2 text-xs font-semibold text-brand-green">{msg}</p>}
      {err && <p className="mb-2 text-xs text-brand-red">{err}</p>}

      {isLoading ? (
        <p className="text-sm text-muted">Loading promo products…</p>
      ) : flashProducts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-gold/40 bg-brand-gold/5 px-4 py-3 text-sm text-muted">
          No promo products yet. Add an existing catalogue item or create a new promo good for this sale.
        </p>
      ) : (
        <ul className="space-y-2">
          {flashProducts.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-black/8 bg-white p-2 dark:border-white/10 dark:bg-black/20"
            >
              <ProductImage src={p.images?.[0]} alt={p.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="text-xs text-muted">
                  {formatPrice(p.price)}
                  {p.compare_at_price ? ` · Was ${formatPrice(p.compare_at_price)}` : ''}
                  {p.badge_label ? ` · ${p.badge_label}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() => removeFromFlash(p)}
                className="shrink-0 text-xs font-bold text-brand-red"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAddExisting && (
        <div className="mt-3 rounded-xl border border-black/8 p-3 dark:border-white/10">
          <p className="mb-2 text-xs font-semibold">Search catalogue to add to flash deals</p>
          <input
            className="input-field"
            placeholder="Type product name…"
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            autoFocus
          />
          {addSearch.trim().length >= 2 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {pickCandidates.length === 0 ? (
                <li className="px-2 py-2 text-xs text-muted">No matching products (or already in flash deals).</li>
              ) : (
                pickCandidates.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => addExisting(p)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <ProductImage src={p.images?.[0]} alt="" className="h-8 w-8 rounded object-cover" />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-brand-green">{formatPrice(p.price)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {showAddNew && (
        <form onSubmit={saveNewPromo} className="mt-3 space-y-3 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3">
          <p className="text-xs font-semibold">New promo good (auto-added to flash deals)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="input-field sm:col-span-2"
              placeholder="Product name *"
              value={promoDraft.name}
              onChange={(e) => setPromoDraft((d) => ({ ...d, name: e.target.value }))}
              required
            />
            <input
              className="input-field"
              type="number"
              step="0.01"
              placeholder="Promo price (GHS) *"
              value={promoDraft.price}
              onChange={(e) => setPromoDraft((d) => ({ ...d, price: e.target.value }))}
              required
            />
            <input
              className="input-field"
              type="number"
              step="0.01"
              placeholder="Was price (optional)"
              value={promoDraft.compare_at_price}
              onChange={(e) => setPromoDraft((d) => ({ ...d, compare_at_price: e.target.value }))}
            />
            <select
              className="admin-filter-select w-full"
              value={promoDraft.category_id}
              onChange={(e) => setPromoDraft((d) => ({ ...d, category_id: e.target.value }))}
            >
              {categoryOptions}
            </select>
            <input
              className="input-field"
              placeholder="Badge (e.g. Deal, Promo)"
              value={promoDraft.badge_label}
              onChange={(e) => setPromoDraft((d) => ({ ...d, badge_label: e.target.value }))}
            />
            <input
              className="input-field"
              type="number"
              placeholder="Stock qty"
              value={promoDraft.stock_qty}
              onChange={(e) => setPromoDraft((d) => ({ ...d, stock_qty: e.target.value }))}
            />
            <ProductImagesField
              className="sm:col-span-2"
              images={promoDraft.images}
              onChange={(images) => setPromoDraft((d) => ({ ...d, images }))}
            />
          </div>
          <button type="submit" disabled={createProduct.isPending} className="btn-primary text-sm">
            {createProduct.isPending ? 'Adding…' : 'Add promo to flash deals'}
          </button>
        </form>
      )}
    </div>
  );
}

function FlashSalePanel({ categoryOptions, payloadFrom, createProduct, updateProduct }) {
  const { data, isLoading } = useFlashSaleSettings();
  const updateFlash = useUpdateFlashSaleSettings();
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState('');

  const form = draft ?? {
    enabled: data?.enabled ?? true,
    title: data?.title ?? 'Flash deals',
    subtitle: data?.subtitle ?? 'Limited picks — ends soon',
    ends_at: toDatetimeLocal(data?.ends_at),
  };

  const save = async (e) => {
    e.preventDefault();
    setSaved('');
    try {
      await updateFlash.mutateAsync({
        enabled: form.enabled,
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        ends_at: form.ends_at || null,
      });
      setDraft(null);
      setSaved('Flash sale settings saved.');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      setSaved(err.response?.data?.message || 'Could not save flash sale settings.');
    }
  };

  return (
    <div className="admin-panel mb-6 space-y-3">
      <form onSubmit={save} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Flash deals section</p>
        {saved && <p className="text-xs font-semibold text-brand-green">{saved}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2 lg:col-span-4">
          <input
            type="checkbox"
            checked={!!form.enabled}
            onChange={(e) => setDraft((d) => ({ ...(d ?? form), enabled: e.target.checked }))}
            className="h-4 w-4 accent-brand-green"
            disabled={isLoading}
          />
          Show flash deals on homepage
        </label>
        <input
          className="input-field"
          placeholder="Section title"
          value={form.title}
          onChange={(e) => setDraft((d) => ({ ...(d ?? form), title: e.target.value }))}
          disabled={isLoading}
          required
        />
        <input
          className="input-field"
          placeholder="Subtitle"
          value={form.subtitle}
          onChange={(e) => setDraft((d) => ({ ...(d ?? form), subtitle: e.target.value }))}
          disabled={isLoading}
        />
        <input
          className="input-field sm:col-span-2"
          type="datetime-local"
          value={form.ends_at}
          onChange={(e) => setDraft((d) => ({ ...(d ?? form), ends_at: e.target.value }))}
          disabled={isLoading}
        />
      </div>
      <p className="text-xs text-muted">
        Configure the homepage countdown, then add promo products below — existing items or new promo goods.
      </p>
      <button type="submit" disabled={updateFlash.isPending || isLoading} className="btn-ghost px-4 py-2 text-sm">
        Save flash settings
      </button>
      </form>

      <FlashDealProducts
        categoryOptions={categoryOptions}
        payloadFrom={payloadFrom}
        createProduct={createProduct}
        updateProduct={updateProduct}
      />
    </div>
  );
}

function MerchFields({ values, onChange, prefix = '' }) {
  return (
    <>
      <p className={`text-xs font-bold uppercase tracking-wide text-muted ${prefix ? 'sm:col-span-3' : 'lg:col-span-3'}`}>
        Card &amp; homepage display
      </p>
      <input
        className="input-field"
        type="number"
        step="0.01"
        placeholder="Compare-at / was price (GHS)"
        value={values.compare_at_price}
        onChange={(e) => onChange('compare_at_price', e.target.value)}
      />
      <input
        className="input-field"
        placeholder="Badge label (e.g. Deal, New)"
        value={values.badge_label}
        onChange={(e) => onChange('badge_label', e.target.value)}
      />
      <input
        className="input-field"
        type="number"
        step="0.1"
        min="0"
        max="5"
        placeholder="Rating (0–5)"
        value={values.rating_avg}
        onChange={(e) => onChange('rating_avg', e.target.value)}
      />
      <input
        className="input-field"
        type="number"
        min="0"
        placeholder="Review count"
        value={values.rating_count}
        onChange={(e) => onChange('rating_count', e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={!!values.is_featured} onChange={(e) => onChange('is_featured', e.target.checked)} className="h-4 w-4 accent-brand-green" />
        Featured on homepage
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={!!values.is_flash_deal} onChange={(e) => onChange('is_flash_deal', e.target.checked)} className="h-4 w-4 accent-brand-green" />
        Flash deal section
      </label>
    </>
  );
}

export default function AdminProductsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [deactivateId, setDeactivateId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const qc = useQueryClient();

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      category_id: categoryFilter || undefined,
    }),
    [search, status, categoryFilter]
  );
  const { data: products, isLoading, isError } = useAdminProducts(params);
  const { data: catData } = useCategories();
  const categories = useMemo(() => flattenCategories(catData?.data || []), [catData]);

  const createProduct = useCreateAdminProduct();
  const updateProduct = useUpdateAdminProduct();
  const deleteProduct = useDeleteAdminProduct();
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const categoryOptions = (
    <>
      <option value="">No category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name}</option>
      ))}
    </>
  );

  const payloadFrom = (v) => ({
    name: v.name.trim(),
    price: Number(v.price),
    cost_price: Number(v.cost_price) || 0,
    compare_at_price: v.compare_at_price !== '' ? Number(v.compare_at_price) : null,
    rating_avg: v.rating_avg !== '' ? Number(v.rating_avg) : null,
    rating_count: Number(v.rating_count) || 0,
    badge_label: v.badge_label.trim() || null,
    stock_qty: Number(v.stock_qty) || 0,
    category_id: v.category_id ? Number(v.category_id) : null,
    status: v.status,
    is_preorder: !!v.is_preorder,
    requires_custom_proof: !!v.requires_custom_proof,
    is_featured: !!v.is_featured,
    is_flash_deal: !!v.is_flash_deal,
    origin_country: v.origin_country.trim() || null,
    tags: tagsToArray(v.tags),
    images: Array.isArray(v.images) ? v.images.filter(Boolean).slice(0, 5) : [],
  });

  const saveNew = async (e) => {
    e.preventDefault();
    setPageError('');
    setPageSuccess('');
    try {
      await createProduct.mutateAsync(payloadFrom(draft));
      setDraft(EMPTY_DRAFT);
      setPageSuccess('Product added. Check the shop or homepage to see card display updates.');
      setTimeout(() => setPageSuccess(''), 4000);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not create product.');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setPageError('');
    setPageSuccess('');
    try {
      await updateProduct.mutateAsync({ id: editing.id, ...payloadFrom(editing) });
      setEditing(null);
      setPageSuccess('Product saved. Shop and homepage will show the updated card display.');
      setTimeout(() => setPageSuccess(''), 4000);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not update product.');
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateId) return;
    setPageError('');
    try {
      await deleteProduct.mutateAsync(deactivateId);
      setDeactivateId(null);
    } catch {
      setPageError('Could not deactivate product.');
      setDeactivateId(null);
    }
  };

  const openEdit = (p) => {
    setEditing({
      ...p,
      price: p.price,
      cost_price: p.cost_price ?? '',
      compare_at_price: p.compare_at_price ?? '',
      rating_avg: p.rating_avg ?? '',
      rating_count: p.rating_count ?? '',
      badge_label: p.badge_label ?? '',
      stock_qty: p.stock_qty,
      category_id: p.category_id ?? '',
      origin_country: p.origin_country ?? '',
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
      is_preorder: !!p.is_preorder,
      requires_custom_proof: !!p.requires_custom_proof,
      is_featured: !!p.is_featured,
      is_flash_deal: !!p.is_flash_deal,
      images: Array.isArray(p.images) ? [...p.images] : [],
    });
  };

  const exportCsv = async (columnKeys) => {
    setExporting(true);
    try {
      await downloadAdminProductsExport(params, columnKeys);
      setExportModalOpen(false);
    } catch {
      window.alert('Could not export products. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await downloadAdminProductsImportTemplate();
    } catch {
      window.alert('Could not download import template.');
    }
  };

  const importCsv = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setPageError('');
    try {
      const res = await uploadAdminProductsImport(file);
      setPageSuccess(res.message || 'Import complete.');
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      setTimeout(() => setPageSuccess(''), 5000);
      if (res.errors?.length) {
        setPageError(res.errors.join(' '));
      }
    } catch (err) {
      setPageError(err.response?.data?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Products" subtitle="Manage catalogue, pricing, categories, and how products appear on cards.">
        <div className="flex flex-wrap gap-3">
          <AdminSearchBar value={search} onChange={setSearch} placeholder="Search products…" className="flex-1 sm:max-w-sm" />
          <AdminFilterBar>
            <AdminFilterSelect value={categoryFilter} onChange={setCategoryFilter} label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name}</option>
              ))}
            </AdminFilterSelect>
            <AdminFilterSelect value={status} onChange={setStatus} label="Status">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </AdminFilterSelect>
          </AdminFilterBar>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={exporting}
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:bg-[#1E1E1E]"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-black/[0.03] dark:border-white/15 dark:bg-[#1E1E1E]"
          >
            Import template
          </button>
          <label className="cursor-pointer rounded-lg border border-brand-green/40 bg-brand-green/10 px-4 py-2 text-sm font-bold text-brand-green hover:bg-brand-green/15">
            {importing ? 'Importing…' : 'Import CSV'}
            <input type="file" accept=".csv,text/csv" className="hidden" disabled={importing} onChange={importCsv} />
          </label>
        </div>
      </AdminPageHeader>

      <ExportColumnModal
        open={exportModalOpen}
        type="products"
        onClose={() => setExportModalOpen(false)}
        onExport={exportCsv}
        exporting={exporting}
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />
      {pageSuccess && (
        <p className="mb-4 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-green">
          {pageSuccess}
        </p>
      )}

      <FlashSalePanel
        categoryOptions={categoryOptions}
        payloadFrom={payloadFrom}
        createProduct={createProduct}
        updateProduct={updateProduct}
      />

      <form onSubmit={saveNew} className="admin-panel mb-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Add product</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className="input-field sm:col-span-2 lg:col-span-1" placeholder="Product name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} required />
          <select className="admin-filter-select w-full" value={draft.category_id} onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}>{categoryOptions}</select>
          <select className="admin-filter-select w-full" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
          </select>
          <input className="input-field" type="number" step="0.01" placeholder="Sell price (GHS)" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} required />
          <input className="input-field" type="number" step="0.01" placeholder="Cost price (GHS)" value={draft.cost_price} onChange={(e) => setDraft((d) => ({ ...d, cost_price: e.target.value }))} />
          <input className="input-field" type="number" placeholder="Stock qty" value={draft.stock_qty} onChange={(e) => setDraft((d) => ({ ...d, stock_qty: e.target.value }))} />
          <input className="input-field" placeholder="Tags (comma separated)" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} />
          <input className="input-field" placeholder="Origin country" value={draft.origin_country} onChange={(e) => setDraft((d) => ({ ...d, origin_country: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={draft.is_preorder} onChange={(e) => setDraft((d) => ({ ...d, is_preorder: e.target.checked }))} className="h-4 w-4 accent-brand-green" />
            By air (international)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={!!draft.requires_custom_proof} onChange={(e) => setDraft((d) => ({ ...d, requires_custom_proof: e.target.checked }))} className="h-4 w-4 accent-brand-green" />
            Requires custom proof (badges)
          </label>
          <ProductImagesField
            className="sm:col-span-2 lg:col-span-3"
            images={draft.images}
            onChange={(images) => setDraft((d) => ({ ...d, images }))}
          />
          <MerchFields values={draft} onChange={(key, val) => setDraft((d) => ({ ...d, [key]: val }))} />
        </div>
        <button type="submit" disabled={createProduct.isPending} className="btn-primary">+ Add product</button>
      </form>

      {isLoading ? (
        <ProductGridSkeleton count={6} />
      ) : isError ? (
        <p className="text-sm text-brand-red">Could not load products.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {(products || []).map((p) => (
            <article key={p.id} className="admin-panel overflow-hidden p-0">
              <div className="aspect-square bg-black/[0.03] dark:bg-white/5">
                <ProductImage src={p.images?.[0]} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-bold">{p.name}</p>
                {p.category_name && <p className="mt-0.5 text-xs font-semibold text-brand-gold">{p.category_name}</p>}
                <p className="font-extrabold text-brand-green">{formatPrice(p.price)}</p>
                <p className="text-xs text-muted">
                  {p.compare_at_price ? `Was ${formatPrice(p.compare_at_price)} · ` : ''}
                  Stock {p.stock_qty} · {p.status}
                  {p.is_featured ? ' · Featured' : ''}{p.is_flash_deal ? ' · Flash' : ''}
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => openEdit(p)} className="text-xs font-bold text-brand-green">Edit</button>
                  <button type="button" onClick={() => setDeactivateId(p.id)} className="text-xs font-bold text-brand-red">Deactivate</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-extrabold">Edit product</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className="input-field sm:col-span-2" value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} placeholder="Name" />
              <select className="admin-filter-select w-full sm:col-span-2" value={editing.category_id} onChange={(e) => setEditing((x) => ({ ...x, category_id: e.target.value }))}>{categoryOptions}</select>
              <input className="input-field" type="number" step="0.01" value={editing.price} onChange={(e) => setEditing((x) => ({ ...x, price: e.target.value }))} placeholder="Sell price" />
              <input className="input-field" type="number" step="0.01" value={editing.cost_price} onChange={(e) => setEditing((x) => ({ ...x, cost_price: e.target.value }))} placeholder="Cost price" />
              <input className="input-field" type="number" value={editing.stock_qty} onChange={(e) => setEditing((x) => ({ ...x, stock_qty: e.target.value }))} placeholder="Stock" />
              <input className="input-field" placeholder="Tags" value={editing.tags} onChange={(e) => setEditing((x) => ({ ...x, tags: e.target.value }))} />
              <input className="input-field sm:col-span-2" placeholder="Origin country" value={editing.origin_country} onChange={(e) => setEditing((x) => ({ ...x, origin_country: e.target.value }))} />
              <select className="admin-filter-select w-full sm:col-span-2" value={editing.status || 'active'} onChange={(e) => setEditing((x) => ({ ...x, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
              <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                <input type="checkbox" checked={!!editing.is_preorder} onChange={(e) => setEditing((x) => ({ ...x, is_preorder: e.target.checked }))} className="h-4 w-4 accent-brand-green" />
                By air (international)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                <input type="checkbox" checked={!!editing.requires_custom_proof} onChange={(e) => setEditing((x) => ({ ...x, requires_custom_proof: e.target.checked }))} className="h-4 w-4 accent-brand-green" />
                Requires custom proof
              </label>
              <ProductImagesField
                className="sm:col-span-2"
                images={editing.images || []}
                onChange={(images) => setEditing((x) => ({ ...x, images }))}
              />
              <MerchFields
                values={editing}
                prefix="edit"
                onChange={(key, val) => setEditing((x) => ({ ...x, [key]: val }))}
              />
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={saveEdit} className="btn-primary flex-1">Save</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2 font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate product?"
        message="This product will be marked inactive and hidden from the shop."
        confirmLabel="Deactivate"
        loading={deleteProduct.isPending}
      />
    </div>
  );
}
