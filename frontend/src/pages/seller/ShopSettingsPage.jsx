import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ShopLogoField from '../../components/shop/ShopLogoField';
import LocationMapPicker from '../../components/map/LocationMapPicker';
import { useUpdateShopProfile, useUploadShopLogo } from '../../hooks/shop';
import { AvailabilityHint, useAvailabilityCheck } from '../../hooks/useAvailabilityCheck';

export default function ShopSettingsPage() {
  const { shop: initialShop } = useOutletContext();
  const uploadLogo = useUploadShopLogo();
  const update = useUpdateShopProfile();
  const [form, setForm] = useState({
    name: initialShop?.name || '',
    description: initialShop?.description || '',
    contact_phone: initialShop?.contact_phone || '',
    customer_service_phone: initialShop?.customer_service_phone || '',
    city: initialShop?.city || '',
    street_address: initialShop?.street_address || '',
    region: initialShop?.region || '',
    latitude: initialShop?.latitude ?? null,
    longitude: initialShop?.longitude ?? null,
    allows_shop_pickup: !!initialShop?.allows_shop_pickup,
    storefront_mode: initialShop?.storefront_mode || 'focused',
    logo_url: initialShop?.logo_url || '',
    bank_name: initialShop?.bank_name || '',
    bank_account_name: initialShop?.bank_account_name || '',
    bank_account_number: initialShop?.bank_account_number || '',
    momo_number: initialShop?.momo_number || '',
  });
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const shopNameCheck = useAvailabilityCheck('shop_name', form.name, {
    excludeShopId: initialShop?.id,
    minLength: 2,
    enabled: !!form.name.trim() && form.name.trim() !== (initialShop?.name || ''),
  });

  useEffect(() => {
    if (initialShop) {
      setForm({
        name: initialShop.name || '',
        description: initialShop.description || '',
        contact_phone: initialShop.contact_phone || '',
        customer_service_phone: initialShop.customer_service_phone || '',
        city: initialShop.city || '',
        street_address: initialShop.street_address || '',
        region: initialShop.region || '',
        latitude: initialShop.latitude ?? null,
        longitude: initialShop.longitude ?? null,
        allows_shop_pickup: !!initialShop.allows_shop_pickup,
        storefront_mode: initialShop.storefront_mode || 'focused',
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
    if (form.name.trim() !== (initialShop?.name || '')) {
      if (shopNameCheck.checking) {
        setError('Please wait while we verify the shop name.');
        return;
      }
      if (shopNameCheck.available === false) {
        setError(shopNameCheck.message || 'This shop name is already taken.');
        return;
      }
    }
    try {
      await update.mutateAsync({
        ...form,
        logo_url: form.logo_url.trim() || null,
        description: form.description.trim() || null,
        allows_shop_pickup: form.allows_shop_pickup && form.latitude != null && form.longitude != null,
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
          {form.name.trim() !== (initialShop?.name || '') ? (
            <AvailabilityHint check={shopNameCheck} />
          ) : (
            <p className="mt-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L9 11.94l-1.72-1.72a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z"
                    clipRule="evenodd"
                  />
                </svg>
                Current shop name
              </span>
            </p>
          )}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Shop phone</span>
            <input className="input-field w-full" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Customer service / WhatsApp</span>
            <input
              className="input-field w-full"
              value={form.customer_service_phone}
              onChange={(e) => set('customer_service_phone', e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">About your shop</span>
          <textarea className="input-field w-full" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="rounded-xl border border-black/8 p-4 dark:border-white/10">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Customer link privacy</p>
          <p className="mt-1 text-xs text-muted">
            Controls what customers see when they open your shop link. Checkout still runs on DanyPathMart.
          </p>
          <div className="mt-3 space-y-2">
            {[
              {
                value: 'focused',
                title: 'Focused (recommended)',
                hint: 'Shop-only experience. Soft link to explore DanyPathMart. Listed in Browse shops.',
              },
              {
                value: 'locked',
                title: 'Locked',
                hint: 'Shop-only — no marketplace exit links. Hidden from Browse shops; your link still works.',
              },
              {
                value: 'open',
                title: 'Open',
                hint: 'Customers can jump to Browse shops, DPM catalog, and home from your storefront.',
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                  form.storefront_mode === opt.value
                    ? 'border-brand-green bg-brand-green/5'
                    : 'border-black/8 dark:border-white/10'
                }`}
              >
                <input
                  type="radio"
                  className="mt-1"
                  name="storefront_mode"
                  value={opt.value}
                  checked={form.storefront_mode === opt.value}
                  onChange={() => set('storefront_mode', opt.value)}
                />
                <span>
                  <span className="font-semibold">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-black/8 p-4 dark:border-white/10">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Location & pickup</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">City</span>
              <input className="input-field w-full" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Region</span>
              <input className="input-field w-full" value={form.region} onChange={(e) => set('region', e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">Street address</span>
              <input className="input-field w-full" value={form.street_address} onChange={(e) => set('street_address', e.target.value)} />
            </label>
          </div>
          <div className="mt-4">
            <LocationMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={({ latitude, longitude }) => setForm((f) => ({ ...f, latitude, longitude }))}
            />
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.allows_shop_pickup}
              onChange={(e) => set('allows_shop_pickup', e.target.checked)}
            />
            <span>
              <span className="font-semibold">Allow in-person pickup at my shop</span>
              <span className="mt-0.5 block text-xs text-muted">Customers can collect orders at your pinned location.</span>
            </span>
          </label>
        </div>

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
