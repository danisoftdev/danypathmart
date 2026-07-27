import { useEffect, useMemo, useState } from 'react';
import {
  useCreateShopProduct,
  useResetShopStock,
  useShopProducts,
  useUpdateShopProduct,
  useUploadShopLogo,
} from '../../hooks/shop';
import { useCategories } from '../../hooks/catalog';
import { flattenCategories } from '../../lib/categories';
import ShopPromoFields from '../../components/shop/ShopPromoFields';
import ShopProductImagesField from '../../components/shop/ShopProductImagesField';
import { formatPrice } from '../../lib/currency';
import { productDisplayBadges } from '../../lib/shopPromo';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { printInventoryList } from '../../lib/reportsDocuments';
import { useCompanyStore } from '../../store/companyStore';
import { useOutletContext } from 'react-router-dom';
import Modal from '../../components/dashboard/Modal';
import api from '../../lib/api';

const EMPTY = {
  name: '',
  price: '',
  stock_qty: '0',
  description: '',
  category_id: '',
  shop_badge_label: '',
  shop_promo_free_delivery: false,
};

function promoFromProduct(product) {
  const promo = product?.shop_promo;
  return {
    shop_badge_label: promo?.shop_badge_label || '',
    shop_promo_free_delivery: !!promo?.shop_promo_free_delivery,
  };
}

function listingLabel(status) {
  const map = {
    pending: 'Pending',
    approved: 'Live',
    rejected: 'Unpublished',
    none: '—',
  };
  return map[status] || status;
}

function ProductModal({ product, onClose, onSave, loading, categories, uploadFile }) {
  const [form, setForm] = useState(
    product
      ? {
          name: product.name,
          price: String(product.price),
          stock_qty: String(product.stock_qty ?? 0),
          description: product.description || '',
          category_id: product.category_id ? String(product.category_id) : '',
          ...promoFromProduct(product),
        }
      : EMPTY
  );
  const [images, setImages] = useState(() => (product?.images || []).filter(Boolean));
  const [promo, setPromo] = useState(() => (product ? promoFromProduct(product) : { shop_badge_label: '', shop_promo_free_delivery: false }));

  useEffect(() => {
    setPromo(product ? promoFromProduct(product) : { shop_badge_label: '', shop_promo_free_delivery: false });
    setImages((product?.images || []).filter(Boolean));
  }, [product?.id]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      name: form.name.trim(),
      price: Number(form.price),
      stock_qty: Number(form.stock_qty) || 0,
      description: form.description.trim() || undefined,
      category_id: form.category_id ? Number(form.category_id) : undefined,
      images,
      shop_badge_label: promo.shop_badge_label || null,
      shop_promo_free_delivery: promo.shop_promo_free_delivery,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && onClose()}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold">{product ? 'Edit product' : 'Add product'}</h2>
        <p className="mt-1 text-xs text-muted">Published to your store right away. Admin may unpublish with a reason if needed.</p>
        {product?.listing_status === 'rejected' && product?.listing_admin_note && (
          <p className="mt-3 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
            Unpublished reason: {product.listing_admin_note}
          </p>
        )}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Name</span>
            <input className="input-field w-full" value={form.name} onChange={set('name')} required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Price (GHS)</span>
              <input type="number" min="0" step="0.01" className="input-field w-full" value={form.price} onChange={set('price')} required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Stock qty</span>
              <input type="number" min="0" className="input-field w-full" value={form.stock_qty} onChange={set('stock_qty')} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Category</span>
            <select className="input-field w-full" value={form.category_id} onChange={set('category_id')}>
              <option value="">None</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Description</span>
            <textarea className="input-field w-full" rows={3} value={form.description} onChange={set('description')} />
          </label>
          <ShopProductImagesField urls={images} onChange={setImages} uploadFile={uploadFile} />
          <ShopPromoFields value={promo} onChange={setPromo} />
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Saving…' : product ? 'Save & publish' : 'Publish product'}
            </button>
            <button type="button" className="btn-ghost px-4" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ShopProductsPage() {
  const company = useCompanyStore((s) => s.company);
  const outlet = useOutletContext() || {};
  const shop = outlet.shop;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      stock_status: stockStatus || undefined,
      category_id: categoryFilter || undefined,
    }),
    [search, status, stockStatus, categoryFilter]
  );

  const { data: products = [], isLoading } = useShopProducts(params);
  const { data: catData } = useCategories();
  const categories = flattenCategories(catData?.data ?? []);
  const create = useCreateShopProduct();
  const update = useUpdateShopProduct();
  const resetStock = useResetShopStock();
  const uploadLogo = useUploadShopLogo();

  const filterLabel = useMemo(() => {
    const bits = [shop?.name ? `${shop.name} inventory` : 'Shop inventory'];
    if (stockStatus === 'in_stock') bits.push('in stock');
    if (stockStatus === 'low') bits.push('low stock (≤5)');
    if (stockStatus === 'out') bits.push('out of stock');
    if (status) bits.push(status);
    if (categoryFilter) {
      const cat = categories.find((c) => String(c.id) === String(categoryFilter));
      if (cat) bits.push(cat.name);
    }
    if (search.trim()) bits.push(`“${search.trim()}”`);
    return bits.join(' · ');
  }, [shop?.name, stockStatus, status, categoryFilter, search, categories]);

  const uploadFile = async (file) => uploadLogo.mutateAsync(file);

  const save = async (payload) => {
    try {
      setToastError(false);
      if (modal?.id) {
        const res = await update.mutateAsync({ id: modal.id, ...payload });
        setToast(res.message || 'Product updated.');
      } else {
        const res = await create.mutateAsync(payload);
        setToast(res.message || 'Product published to your store.');
      }
      setModal(null);
      setTimeout(() => setToast(''), 4000);
    } catch (e) {
      setToastError(true);
      setToast(e.response?.data?.message || 'Could not save product.');
    }
  };

  const printInventory = async () => {
    setPrinting(true);
    try {
      const { data } = await api.get('/shop/products', {
        params: { ...params, inventory: '1' },
      });
      printInventoryList(data.data || [], company, { label: filterLabel });
    } catch {
      setToastError(true);
      setToast('Could not load inventory for printing.');
    } finally {
      setPrinting(false);
    }
  };

  const confirmReset = async () => {
    if (resetConfirm.trim().toUpperCase() !== 'RESET') return;
    try {
      setToastError(false);
      const res = await resetStock.mutateAsync({
        ...params,
        confirm: 'RESET',
      });
      setResetOpen(false);
      setResetConfirm('');
      setToast(res.message || `Reset ${res.updated || 0} product(s).`);
      setTimeout(() => setToast(''), 5000);
    } catch (e) {
      setToastError(true);
      setToast(e.response?.data?.message || 'Could not reset inventory.');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold md:text-2xl">Products</h1>
          <p className="mt-1 text-sm text-muted">
            Listings go live on your store immediately. Print and reset use your current filters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:bg-[#1E1E1E]"
            onClick={printInventory}
            disabled={printing}
          >
            {printing ? 'Preparing…' : 'Print inventory'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-brand-red/40 bg-brand-red/10 px-4 py-2 text-sm font-bold text-brand-red hover:bg-brand-red/15"
            onClick={() => {
              setResetConfirm('');
              setResetOpen(true);
            }}
          >
            Reset inventory
          </button>
          <button type="button" className="btn-primary min-h-[44px] px-4" onClick={() => setModal({})}>
            Add product
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="input-field min-w-[180px] flex-1 sm:max-w-xs"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="admin-filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name}</option>
          ))}
        </select>
        <select className="admin-filter-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
        </select>
        <select className="admin-filter-select" value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} aria-label="Stock">
          <option value="">All stock</option>
          <option value="in_stock">In stock</option>
          <option value="low">Low stock (≤5)</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      <p className="mt-2 text-xs text-muted">
        Showing {products.length} product(s) · {filterLabel}
      </p>

      {toast && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
            toastError
              ? 'bg-brand-red/10 text-brand-red'
              : 'bg-brand-green/10 text-brand-green'
          }`}
        >
          {toast}
        </p>
      )}

      {isLoading ? (
        <div className="mt-6"><AdminTableSkeleton rows={4} cols={4} /></div>
      ) : products.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No products match these filters. Clear filters or add a listing.</p>
      ) : (
        <div className="mt-6 admin-panel overflow-x-auto">
          <table className="admin-table w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Promo</th>
                <th>Listing</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-semibold">{p.name}</div>
                    {p.listing_status === 'rejected' && p.listing_admin_note && (
                      <p className="mt-0.5 text-xs text-brand-red">Reason: {p.listing_admin_note}</p>
                    )}
                  </td>
                  <td>{formatPrice(p.price)}</td>
                  <td>{p.stock_qty}</td>
                  <td className="text-xs">
                    {productDisplayBadges(p).length
                      ? productDisplayBadges(p).join(', ')
                      : '—'}
                  </td>
                  <td>{listingLabel(p.listing_status)}</td>
                  <td>
                    <button type="button" className="text-xs font-bold text-brand-green hover:underline" onClick={() => setModal(p)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ProductModal
          product={modal.id ? modal : null}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={save}
          loading={create.isPending || update.isPending}
          uploadFile={uploadFile}
        />
      )}

      {resetOpen && (
        <Modal open onClose={resetStock.isPending ? undefined : () => setResetOpen(false)} title="Reset shop inventory?" maxWidth="max-w-md">
          <p className="text-sm text-muted">
            This sets <strong>stock to 0</strong> for products in your shop that match your current filters
            ({filterLabel}). Other shops are not affected.
          </p>
          <p className="mt-3 text-sm text-muted">
            Type <strong>RESET</strong> to confirm.
          </p>
          <input
            className="input-field mt-3 w-full font-mono uppercase"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="RESET"
            autoFocus
          />
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className="btn-ghost" disabled={resetStock.isPending} onClick={() => setResetOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={resetStock.isPending || resetConfirm.trim().toUpperCase() !== 'RESET'}
              onClick={confirmReset}
            >
              {resetStock.isPending ? 'Resetting…' : 'Reset to zero'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
