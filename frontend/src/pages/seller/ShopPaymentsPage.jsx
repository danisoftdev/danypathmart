import { useEffect, useState } from 'react';
import { SellerPolicyLinks } from '../../components/legal/SellerPolicyLinks';
import { useShopProfile, useUpdateShopPaymentSettings } from '../../hooks/shop';

export default function ShopPaymentsPage() {
  const { data: shop, isLoading } = useShopProfile();
  const update = useUpdateShopPaymentSettings();
  const [form, setForm] = useState({
    payment_paystack_enabled: false,
    payment_momo_enabled: true,
    payment_physical_enabled: true,
    paystack_subaccount_code: '',
    momo_number: '',
  });
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (shop) {
      setForm({
        payment_paystack_enabled: !!shop.payment_paystack_enabled,
        payment_momo_enabled: shop.payment_momo_enabled !== false,
        payment_physical_enabled: shop.payment_physical_enabled !== false,
        paystack_subaccount_code: shop.paystack_subaccount_code || '',
        momo_number: shop.momo_number || '',
      });
    }
  }, [shop?.id]);

  if (isLoading) {
    return <p className="text-sm text-muted">Loading payment settings…</p>;
  }

  const verified = !!shop?.verified_at;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setToast('');
    try {
      await update.mutateAsync(form);
      setToast('Payment settings saved.');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save settings.');
    }
  };

  return (
    <form onSubmit={save}>
      <h1 className="text-xl font-extrabold md:text-2xl">Payment settings</h1>
      <p className="mt-1 text-sm text-muted">
        Choose how customers pay you on your shop link. You receive 100% — no commission.
      </p>

      {toast && <p className="mt-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{toast}</p>}
      {error && <p className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}

      <SellerPolicyLinks className="mt-4" />

      <div className="mt-6 space-y-4 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.payment_physical_enabled}
            onChange={(e) => setForm((f) => ({ ...f, payment_physical_enabled: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="font-bold">Pay in person</span>
            <span className="mt-0.5 block text-sm text-muted">Cash or payment at your shop / on delivery. You confirm in Orders.</span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.payment_momo_enabled}
            onChange={(e) => setForm((f) => ({ ...f, payment_momo_enabled: e.target.checked }))}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="font-bold">Mobile Money (manual)</span>
            <span className="mt-0.5 block text-sm text-muted">Customer pays your MoMo number; you mark paid when received.</span>
            {form.payment_momo_enabled && (
              <input
                className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                placeholder="MoMo number"
                value={form.momo_number}
                onChange={(e) => setForm((f) => ({ ...f, momo_number: e.target.value }))}
              />
            )}
          </span>
        </label>

        <label className={`flex items-start gap-3 ${!verified ? 'opacity-60' : ''}`}>
          <input
            type="checkbox"
            disabled={!verified}
            checked={form.payment_paystack_enabled}
            onChange={(e) => setForm((f) => ({ ...f, payment_paystack_enabled: e.target.checked }))}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="font-bold">Paystack (online)</span>
            <span className="mt-0.5 block text-sm text-muted">
              {verified
                ? 'Card / MoMo via your Paystack subaccount. Payments go directly to you.'
                : 'Available after your shop is verified by DanyPathMart.'}
            </span>
            {form.payment_paystack_enabled && verified && (
              <input
                className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                placeholder="Paystack subaccount code (ACCT_...)"
                value={form.paystack_subaccount_code}
                onChange={(e) => setForm((f) => ({ ...f, paystack_subaccount_code: e.target.value }))}
              />
            )}
          </span>
        </label>
      </div>

      <button type="submit" disabled={update.isPending} className="btn-primary mt-6 min-h-[44px] px-6">
        {update.isPending ? 'Saving…' : 'Save payment settings'}
      </button>
    </form>
  );
}
