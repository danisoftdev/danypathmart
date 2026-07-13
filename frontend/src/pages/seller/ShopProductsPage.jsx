import { useEffect, useState } from 'react';
import {
  useCreateShopProduct,
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
  const { data: products = [], isLoading } = useShopProducts();
  const { data: catData } = useCategories();
  const categories = flattenCategories(catData?.data ?? []);
  const create = useCreateShopProduct();
  const update = useUpdateShopProduct();
  const uploadLogo = useUploadShopLogo();
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  const uploadFile = async (file) => uploadLogo.mutateAsync(file);

  const save = async (payload) => {
    try {
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
      setToast(e.response?.data?.message || 'Could not save product.');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold md:text-2xl">Products</h1>
          <p className="mt-1 text-sm text-muted">Listings go live on your store immediately.</p>
        </div>
        <button type="button" className="btn-primary min-h-[44px] px-4" onClick={() => setModal({})}>
          Add product
        </button>
      </div>

      {toast && (
        <p className="mt-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{toast}</p>
      )}

      {isLoading ? (
        <div className="mt-6"><AdminTableSkeleton rows={4} cols={4} /></div>
      ) : products.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No products yet. Add your first listing.</p>
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
    </div>
  );
}
