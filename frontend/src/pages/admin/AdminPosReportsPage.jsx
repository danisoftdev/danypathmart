import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { formatPrice } from '../../lib/currency';
import { usePosReportsSummary } from '../../hooks/pos';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';

export default function AdminPosReportsPage() {
  const user = useAuthStore((s) => s.user);
  const canView = user?.role === 'super_admin' || hasPermission(user, 'view_pos_reports') || hasPermission(user, 'manage_pos_shifts');

  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading } = usePosReportsSummary(from, to, canView);
  const summary = data?.data;

  if (!canView) return <Navigate to="/admin" replace />;

  return (
    <div>
      <AdminPageHeader title="POS reports" subtitle="Sales and payment breakdown for in-store register." />
      <div className="mb-6 flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="font-semibold">From</span>
          <input type="date" className="input-field ml-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="font-semibold">To</span>
          <input type="date" className="input-field ml-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
            <p className="text-sm text-muted">Sales count</p>
            <p className="text-2xl font-extrabold">{summary.sale_count}</p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
            <p className="text-sm text-muted">Gross total</p>
            <p className="text-2xl font-extrabold text-brand-green">{formatPrice(summary.gross_total)}</p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
            <p className="text-sm text-muted">Discounts given</p>
            <p className="text-2xl font-extrabold">{formatPrice(summary.discount_total)}</p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-white p-5 sm:col-span-2 lg:col-span-3 dark:border-white/10 dark:bg-[#1E1E1E]">
            <p className="mb-3 font-extrabold">Payments by method</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {Object.entries(summary.payments ?? {}).map(([method, amt]) => (
                <p key={method} className="text-sm capitalize">
                  {method}: <strong>{formatPrice(amt)}</strong>
                </p>
              ))}
              {Object.keys(summary.payments ?? {}).length === 0 && (
                <p className="text-sm text-muted">No POS payments in this period.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
