import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCompanySettings } from '../../hooks/admin';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import {
  useAdminEmployees,
  useAdminLeaveRequests,
  useCreateLeaveRequest,
  useUpdateLeaveRequest,
} from '../../hooks/workforce';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import Modal from '../../components/dashboard/Modal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

const STATUS_STYLE = {
  pending: 'bg-brand-gold/20 text-amber-900 dark:text-brand-gold',
  approved: 'bg-brand-green/15 text-brand-green',
  rejected: 'bg-brand-red/15 text-brand-red',
  cancelled: 'bg-black/10 text-muted',
};

function CreateLeaveModal({ employees, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    employee_id: employees[0]?.employee_id ? String(employees[0].employee_id) : '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    days_requested: '',
    reason: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      employee_id: Number(form.employee_id),
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days_requested: form.days_requested ? Number(form.days_requested) : undefined,
      reason: form.reason.trim(),
    });
  };

  return (
    <Modal open onClose={loading ? undefined : onClose} title="New leave request" maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Employee</span>
          <select className="admin-filter-select w-full" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
            {employees.map((e) => (
              <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.staff_id})</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Type</span>
          <select className="admin-filter-select w-full" value={form.leave_type} onChange={(e) => set('leave_type', e.target.value)}>
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="unpaid">Unpaid</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Start</span>
            <input type="date" className="input-field w-full" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">End</span>
            <input type="date" className="input-field w-full" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Days (optional)</span>
          <input type="number" step="0.5" min="0.5" className="input-field w-24" value={form.days_requested} onChange={(e) => set('days_requested', e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Reason</span>
          <textarea className="input-field w-full min-h-[80px]" value={form.reason} onChange={(e) => set('reason', e.target.value)} required />
        </label>
        <div className="flex justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading || !form.employee_id} className="btn-primary">{loading ? 'Saving…' : 'Submit'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminLeaveRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const canView = hasAnyPermission(user, ['view_leave_requests', 'manage_leave_requests']);
  const canManage = hasPermission(user, 'manage_leave_requests');
  const { data: settingsData } = useCompanySettings(!!user && canView);
  const leaveEnabled = !!settingsData?.settings?.leave_requests_enabled;
  const { data: employees = [] } = useAdminEmployees(!!user && canView);
  const { data: requests = [], isLoading } = useAdminLeaveRequests('all', !!user && canView && leaveEnabled);
  const createLeave = useCreateLeaveRequest();
  const updateLeave = useUpdateLeaveRequest();

  const [showCreate, setShowCreate] = useState(false);
  const [pageError, setPageError] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  if (user && !canView) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const setStatus = async (row, status) => {
    setPageError('');
    try {
      await updateLeave.mutateAsync({ id: row.id, status });
    } catch {
      setPageError('Could not update leave request.');
    }
  };

  const create = async (payload) => {
    setPageError('');
    try {
      await createLeave.mutateAsync(payload);
      setShowCreate(false);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not create leave request.');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Leave requests"
        subtitle="Approve or reject workforce leave — enable under Company settings → Workforce HR."
        actions={
          canManage && leaveEnabled ? (
            <button type="button" onClick={() => setShowCreate(true)} disabled={!employees.length} className="btn-primary px-4 py-2 text-sm">
              + New request
            </button>
          ) : null
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {!leaveEnabled ? (
        <div className="admin-panel text-sm">
          <p className="font-semibold">Leave requests are disabled.</p>
          <p className="mt-2 text-muted">
            Enable <strong>Leave requests</strong> in{' '}
            <Link to="/admin/company-settings" className="font-bold text-brand-green hover:underline">Company settings</Link>.
          </p>
        </div>
      ) : isLoading ? (
        <AdminTableSkeleton rows={4} cols={7} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${filter === s ? 'bg-brand-green text-white' : 'bg-black/5 dark:bg-white/10'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <AdminTable
            columns={[
              { key: 'employee', label: 'Employee' },
              { key: 'type', label: 'Type' },
              { key: 'dates', label: 'Dates' },
              { key: 'days', label: 'Days' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '', className: 'text-right' },
            ]}
          >
            {filtered.map((r) => (
              <AdminTableRow key={r.id}>
                <AdminTableCell>
                  <p className="font-bold">{r.employee_name}</p>
                  <p className="font-mono text-[10px] text-muted">{r.staff_id}</p>
                </AdminTableCell>
                <AdminTableCell className="capitalize">{r.leave_type}</AdminTableCell>
                <AdminTableCell className="text-sm text-muted">{r.start_date} → {r.end_date}</AdminTableCell>
                <AdminTableCell>{r.days_requested}</AdminTableCell>
                <AdminTableCell>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[r.status] || ''}`}>
                    {r.status}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  {canManage && r.status === 'pending' ? (
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setStatus(r, 'approved')} className="text-xs font-bold text-brand-green">Approve</button>
                      <button type="button" onClick={() => setStatus(r, 'rejected')} className="text-xs font-bold text-brand-red">Reject</button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">{r.reviewer_name || '—'}</span>
                  )}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        </>
      )}

      {showCreate && (
        <CreateLeaveModal
          employees={employees.filter((e) => e.employee_status === 'active')}
          onClose={() => setShowCreate(false)}
          onSave={create}
          loading={createLeave.isPending}
        />
      )}
    </div>
  );
}
