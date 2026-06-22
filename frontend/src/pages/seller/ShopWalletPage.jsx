import { useState } from 'react';
import { useShopWallet, useShopWithdraw } from '../../hooks/shop';
import { formatPrice } from '../../lib/currency';
import { downloadShopSalesExport } from '../../lib/shopExport';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ShopWalletPage() {
  const { data, isLoading } = useShopWallet();
  const withdraw = useShopWithdraw();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const wallet = data?.wallet ?? {};
  const transactions = data?.transactions ?? [];
  const shop = data?.shop ?? {};

  const requestWithdraw = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await withdraw.mutateAsync({
        amount: Number(amount),
        payout_method: method,
        bank_name: shop.bank_name,
        bank_account_name: shop.bank_account_name,
        bank_account_number: shop.bank_account_number,
        momo_number: shop.momo_number,
      });
      setMessage('Withdrawal requested. We will process it shortly.');
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request withdrawal.');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold md:text-2xl">Wallet</h1>
          <p className="mt-1 text-sm text-muted">Earnings move from pending to available when orders are completed.</p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadShopSalesExport();
            } catch {
              setError('Could not download sales CSV.');
            } finally {
              setExporting(false);
            }
          }}
          className="min-h-[40px] rounded-xl border-2 border-brand-green px-4 py-2 text-sm font-bold text-brand-green hover:bg-brand-green/5 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Download sales CSV'}
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6"><AdminTableSkeleton rows={3} cols={3} /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
              <p className="text-xs font-bold uppercase text-muted">Pending</p>
              <p className="mt-1 text-xl font-extrabold">{formatPrice(wallet.balance_pending ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
              <p className="text-xs font-bold uppercase text-muted">Available</p>
              <p className="mt-1 text-xl font-extrabold text-brand-green">{formatPrice(wallet.balance_available ?? 0)}</p>
              {data?.breakdown && (
                <p className="mt-2 text-xs text-muted">
                  Sales {formatPrice(data.breakdown.sales_total ?? 0)} · Referrals {formatPrice(data.breakdown.referral_total ?? 0)}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
              <p className="text-xs font-bold uppercase text-muted">Reserved</p>
              <p className="mt-1 text-xl font-extrabold">{formatPrice(wallet.balance_reserved ?? 0)}</p>
            </div>
          </div>

          <form onSubmit={requestWithdraw} className="mt-8 max-w-md space-y-3 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Request withdrawal</h2>
            {message && <p className="text-sm font-bold text-brand-green">{message}</p>}
            {error && <p className="text-sm text-brand-red">{error}</p>}
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Amount (GHS)</span>
              <input
                type="number"
                min="1"
                step="0.01"
                className="input-field w-full"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Payout method</span>
              <select className="input-field w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="bank">Bank transfer</option>
                <option value="momo">Mobile money</option>
              </select>
            </label>
            <p className="text-xs text-muted">
              Uses payout details on your shop profile
              {shop.bank_name || shop.momo_number ? '' : ' — update them when applying or contact support'}.
            </p>
            <button type="submit" className="btn-primary w-full min-h-[44px]" disabled={withdraw.isPending}>
              {withdraw.isPending ? 'Submitting…' : 'Request withdrawal'}
            </button>
          </form>

          <section className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Recent transactions</h2>
            {transactions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No wallet activity yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-black/5 rounded-2xl border border-black/8 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#1E1E1E]">
                {transactions.slice(0, 20).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold">{t.type}</p>
                      <p className="text-xs text-muted">{formatWhen(t.created_at)}</p>
                    </div>
                    <span className={`font-bold ${Number(t.amount) >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                      {formatPrice(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
