import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import PosShiftReportModal from '../../components/pos/PosShiftReportModal';
import { usePosApproveShift, usePosPendingShifts, usePosRejectShift, usePosShiftHistory } from '../../hooks/pos';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import { formatPrice } from '../../lib/currency';
import api from '../../lib/api';

export default function AdminPosShiftsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'super_admin' || hasPermission(user, 'manage_pos_shifts');
  const [tab, setTab] = useState('pending');
  const { data, isLoading } = usePosPendingShifts(canManage && tab === 'pending');
  const { data: histData, isLoading: histLoading } = usePosShiftHistory(canManage && tab === 'history');
  const approve = usePosApproveShift();
  const reject = usePosRejectShift();
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [zReport, setZReport] = useState(null);

  if (!canManage) return <Navigate to="/admin" replace />;

  const shifts = tab === 'pending' ? (data?.data ?? []) : (histData?.data ?? []);

  return (
    <div>
      <AdminPageHeader title="POS shifts" subtitle="Approve closed shifts and review history." />
      <div className="mb-6 flex gap-2">
        <button type="button" className={tab === 'pending' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('pending')}>Pending</button>
        <button type="button" className={tab === 'history' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('history')}>History</button>
      </div>
      {(isLoading || histLoading) && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && !histLoading && shifts.length === 0 && (
        <p className="rounded-xl border border-black/8 bg-white px-4 py-8 text-center text-sm text-muted dark:border-white/10 dark:bg-[#1E1E1E]">
          {tab === 'pending' ? 'No shifts awaiting approval.' : 'No closed shifts yet.'}
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
              <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                s.status === 'pending_approval' ? 'bg-brand-gold/15 text-brand-gold'
                  : s.status === 'approved' ? 'bg-brand-green/15 text-brand-green'
                    : 'bg-black/10 text-muted'
              }`}>{s.status.replace('_', ' ')}</span>
            </div>
            {s.totals && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <p>Cash: <strong>{formatPrice(s.totals.cash)}</strong></p>
                <p>MoMo: <strong>{formatPrice(s.totals.momo)}</strong></p>
                <p>Sales: <strong>{s.totals.sales}</strong></p>
                <p>Float: <strong>{formatPrice(s.opening_float)}</strong></p>
              </div>
            )}
            {s.expected_cash != null && (
              <div className="mt-3 text-sm">
                <p>Expected cash: <strong>{formatPrice(s.expected_cash)}</strong></p>
                <p>Counted: <strong>{formatPrice(s.counted_cash ?? 0)}</strong></p>
                {s.cash_variance != null && Math.abs(s.cash_variance) > 0.01 && (
                  <p className="text-brand-red font-bold">Variance: {formatPrice(s.cash_variance)}</p>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {s.status === 'pending_approval' && (
                <>
                  <button type="button" className="btn-primary" disabled={approve.isPending} onClick={async () => {
                    const res = await approve.mutateAsync(s.id);
                    if (res.z_report) setZReport(res.z_report);
                  }}>Approve</button>
                  <button type="button" className="btn-secondary" onClick={() => setRejectId(s.id)}>Reject</button>
                </>
              )}
              {s.status !== 'open' && (
                <button type="button" className="btn-secondary text-sm" onClick={async () => {
                  const r = await api.get('/pos/shift/report', { params: { shift_id: s.id, type: 'z' } });
                  setZReport(r.data);
                }}>Z-report</button>
              )}
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
              <button type="button" className="btn-primary flex-1" disabled={!rejectNote.trim() || reject.isPending} onClick={async () => {
                await reject.mutateAsync({ shiftId: rejectId, note: rejectNote });
                setRejectId(null);
                setRejectNote('');
              }}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {zReport && (
        <PosShiftReportModal report={zReport} title="Z-Report" onClose={() => setZReport(null)} />
      )}
    </div>
  );
}
