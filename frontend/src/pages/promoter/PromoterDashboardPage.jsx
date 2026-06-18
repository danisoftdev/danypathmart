import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePromoterDashboard, usePromoterWithdraw } from '../../hooks/promoter';
import { useAuthStore } from '../../store/authStore';
import { formatPrice } from '../../lib/currency';
import CopyableText from '../../components/ui/CopyableText';

export default function PromoterDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = usePromoterDashboard(user?.role === 'promoter');
  const withdraw = usePromoterWithdraw();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!user) return <Navigate to="/login" replace state={{ from: '/promoter' }} />;
  if (user.role !== 'promoter') return <Navigate to="/" replace />;

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted">Loading promoter dashboard…</div>;
  }
  if (isError || !data?.promoter) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Promoter dashboard</h1>
        <p className="mt-3 text-sm text-muted">Could not load your promoter account.</p>
        <Link to="/" className="mt-4 block text-sm font-bold text-brand-green">Back to store</Link>
      </div>
    );
  }

  const promoter = data.promoter;
  const wallet = data.wallet ?? {};
  const referrals = data.referrals ?? [];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const onWithdraw = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await withdraw.mutateAsync({ amount: Number(amount), payout_method: 'bank' });
      setMessage('Withdrawal requested.');
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request withdrawal.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Promoter dashboard</h1>
          <p className="mt-1 text-sm text-muted">{promoter.display_name}</p>
        </div>
        <Link to="/" className="text-sm font-bold text-brand-green">Store</Link>
      </div>

      <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
        <p className="text-xs font-bold uppercase text-muted">Your referral code</p>
        <CopyableText value={promoter.code} className="mt-1 text-lg font-extrabold" />
        <p className="mt-2 text-xs text-muted">
          Share: <CopyableText value={`${origin}/sell?ref=${promoter.code}`} className="text-brand-green" />
        </p>
        <p className="mt-2 text-xs text-muted">
          You earn {data.program?.percent ?? 15}% of the first registration fee when a referred shop pays to join.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase text-muted">Pending</p>
          <p className="mt-1 text-xl font-extrabold">{formatPrice(wallet.balance_pending ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase text-muted">Available</p>
          <p className="mt-1 text-xl font-extrabold text-brand-green">{formatPrice(wallet.balance_available ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase text-muted">Reserved</p>
          <p className="mt-1 text-xl font-extrabold">{formatPrice(wallet.balance_reserved ?? 0)}</p>
        </div>
      </div>

      <form onSubmit={onWithdraw} className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Request withdrawal</h2>
        {message && <p className="mt-2 text-sm font-bold text-brand-green">{message}</p>}
        {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
        <input
          type="number"
          min="1"
          step="0.01"
          className="input-field mt-3 w-full max-w-xs"
          placeholder="Amount (GHS)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="submit" className="btn-primary mt-3 px-4 py-2 text-sm" disabled={withdraw.isPending}>
          {withdraw.isPending ? 'Submitting…' : 'Request payout'}
        </button>
      </form>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Referred shops</h2>
        {referrals.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No referred applications yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {referrals.map((r) => (
              <li key={r.application_id} className="rounded-xl border border-black/8 px-3 py-2 text-sm dark:border-white/10">
                <span className="font-semibold">{r.business_name}</span>
                <span className="ml-2 text-muted">{r.application_status}</span>
                <span className="ml-2 font-bold text-brand-green">{formatPrice(r.commission_amount)}</span>
                <span className="ml-1 text-xs text-muted">({r.status})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
