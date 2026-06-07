import { formatPrice } from '../../lib/currency';
import { useWallet } from '../../hooks/wallet';
import DashboardSection from '../../components/dashboard/DashboardSection';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';

const TYPE_LABELS = {
  refund: 'Order refund',
  admin_credit: 'Store credit',
  admin_debit: 'Adjustment',
  order_payment: 'Order payment',
  adjustment: 'Adjustment',
};

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso.replace(' ', 'T')).toLocaleString();
  } catch {
    return iso;
  }
}

export default function WalletPage() {
  const { data, isLoading, isError } = useWallet();
  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  if (isLoading) {
    return (
      <DashboardSection title="Wallet" subtitle="Your DanyPathMart store credit in Ghana Cedis.">
        <FormPanelSkeleton sections={2} />
      </DashboardSection>
    );
  }

  if (isError) {
    return (
      <DashboardSection title="Wallet" subtitle="Your DanyPathMart store credit in Ghana Cedis.">
        <p className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          Could not load your wallet. Please try again later.
        </p>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection
      title="Wallet"
      subtitle="Store credit from returns and refunds — use at checkout (full or partial)."
    >
      <div className="mb-6 rounded-2xl border border-brand-green/30 bg-gradient-to-br from-brand-green/10 to-brand-gold/10 p-6">
        <p className="text-sm font-semibold text-muted">Available balance</p>
        <p className="mt-1 text-4xl font-extrabold text-brand-green">{formatPrice(balance)}</p>
        <p className="mt-2 text-xs text-muted">Ghana Cedis · store credit only (not withdrawable as cash)</p>
      </div>

      <div className="rounded-2xl border border-black/8 bg-white dark:border-white/10 dark:bg-[#1E1E1E]">
        <p className="border-b border-black/5 px-4 py-3 text-sm font-bold dark:border-white/10">Transaction history</p>
        {transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No wallet activity yet.</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{TYPE_LABELS[tx.type] || tx.type}</p>
                  {tx.note && <p className="mt-0.5 text-xs text-muted">{tx.note}</p>}
                  {tx.order_id && (
                    <p className="mt-0.5 text-xs text-brand-green">Order #{tx.order_id}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted">{formatWhen(tx.created_at)}</p>
                </div>
                <p className={`shrink-0 text-sm font-extrabold ${tx.amount >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatPrice(tx.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardSection>
  );
}
