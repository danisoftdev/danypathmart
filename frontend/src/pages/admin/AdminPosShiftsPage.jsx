import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { usePosApproveShift, usePosPendingShifts, usePosRejectShift } from '../../hooks/pos';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import { formatPrice } from '../../lib/currency';

export default function AdminPosShiftsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'super_admin' || hasPermission(user, 'manage_pos_shifts');
  const { data, isLoading } = usePosPendingShifts(canManage);
  const approve = usePosApproveShift();
  const reject = usePosRejectShift();
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  if (!canManage) return <Navigate to="/admin" replace />;

  const shifts = data?.data ?? [];

  return (
    <div>
      <AdminPageHeader title="POS shift approvals" subtitle="Supervisor sign-off on closed register shifts." />
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && shifts.length === 0 && (
        <p className="rounded-xl border border-black/8 bg-white px-4 py-8 text-center text-sm text-muted dark:border-white/10 dark:bg-[#1E1E1E]">
          No shifts awaiting approval.
        </p>
      )}
      <div className="space-y-4">
        {shifts.map((s) => (
          <div key={s.id} className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-extrabold">{s.location_name} · {s.register_name}</p>
                <p className="text-sm text-muted">Opened by {s.opened_by_name} · Shift #{s.id}</p>
              </div>
              <span className="rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-bold text-brand-gold">Pending</span>
            </div>
            {s.totals && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <p>Cash sales: <strong>{formatPrice(s.totals.cash)}</strong></p>
                <p>MoMo: <strong>{formatPrice(s.totals.momo)}</strong></p>
                <p>Sales: <strong>{s.totals.sales}</strong></p>
                <p>Opening float: <strong>{formatPrice(s.opening_float)}</strong></p>
              </div>
            )}
            <div className="mt-3 text-sm">
              <p>Expected cash: <strong>{formatPrice(s.expected_cash ?? 0)}</strong></p>
              <p>Counted cash: <strong>{formatPrice(s.counted_cash ?? 0)}</strong></p>
              {s.cash_variance != null && (
                <p className={Math.abs(s.cash_variance) > 0.01 ? 'text-brand-red font-bold' : ''}>
                  Variance: {formatPrice(s.cash_variance)}
                </p>
              )}
              {s.variance_note && <p className="text-muted">Note: {s.variance_note}</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-primary" disabled={approve.isPending} onClick={() => approve.mutate(s.id)}>
                Approve
              </button>
              <button type="button" className="btn-secondary" onClick={() => setRejectId(s.id)}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]">
            <h3 className="font-extrabold">Reject shift</h3>
            <textarea className="input-field mt-3 min-h-[80px] w-full" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Reason…" />
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setRejectId(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={!rejectNote.trim() || reject.isPending}
                onClick={async () => {
                  await reject.mutateAsync({ shiftId: rejectId, note: rejectNote });
                  setRejectId(null);
                  setRejectNote('');
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
