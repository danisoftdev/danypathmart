import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ShopLogoField from '../../components/shop/ShopLogoField';
import { useUpdateShopProfile, useUploadShopLogo } from '../../hooks/shop';

export default function ShopSettingsPage() {
  const { shop: initialShop } = useOutletContext();
  const uploadLogo = useUploadShopLogo();
  const update = useUpdateShopProfile();
  const [form, setForm] = useState({
    name: initialShop?.name || '',
    description: initialShop?.description || '',
    contact_phone: initialShop?.contact_phone || '',
    logo_url: initialShop?.logo_url || '',
    bank_name: initialShop?.bank_name || '',
    bank_account_name: initialShop?.bank_account_name || '',
    bank_account_number: initialShop?.bank_account_number || '',
    momo_number: initialShop?.momo_number || '',
  });
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialShop) {
      setForm({
        name: initialShop.name || '',
        description: initialShop.description || '',
        contact_phone: initialShop.contact_phone || '',
        logo_url: initialShop.logo_url || '',
        bank_name: initialShop.bank_name || '',
        bank_account_name: initialShop.bank_account_name || '',
        bank_account_number: initialShop.bank_account_number || '',
        momo_number: initialShop.momo_number || '',
      });
    }
  }, [initialShop?.id]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setToast('');
    try {
      await update.mutateAsync({
        ...form,
        logo_url: form.logo_url.trim() || null,
        description: form.description.trim() || null,
      });
      setToast('Shop profile saved.');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save profile.');
    }
  };

  return (
    <form onSubmit={save}>
      <h1 className="text-xl font-extrabold md:text-2xl">Shop profile</h1>
      <p className="mt-1 text-sm text-muted">Update how your store appears to customers. Logo is optional.</p>

      {toast && (
        <p className="mt-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{toast}</p>
      )}
      {error && <p className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}

      <div className="mt-6 space-y-4 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
        <ShopLogoField
          value={form.logo_url}
          onChange={(url) => set('logo_url', url)}
          uploadFile={(file) => uploadLogo.mutateAsync(file)}
        />

        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Shop name</span>
          <input className="input-field w-full" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Phone</span>
          <input className="input-field w-full" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">About your shop</span>
          <textarea className="input-field w-full" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="rounded-xl border border-black/8 p-4 dark:border-white/10">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Payout details</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">Bank name</span>
              <input className="input-field w-full" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Account name</span>
              <input className="input-field w-full" value={form.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Account number</span>
              <input className="input-field w-full" value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">Mobile money</span>
              <input className="input-field w-full" value={form.momo_number} onChange={(e) => set('momo_number', e.target.value)} />
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary min-h-[44px] w-full sm:w-auto" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}
