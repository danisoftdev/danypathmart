import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import { useAdminEmployees, useUpdateEmployeeProfile } from '../../hooks/workforce';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import Modal from '../../components/dashboard/Modal';
import CopyableText from '../../components/ui/CopyableText';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

const EMP_TYPES = [
  { value: '', label: 'Not set' },
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'contract', label: 'Contract' },
];

function ProfileModal({ employee, employees, onClose, onSave, loading, canManage }) {
  const [form, setForm] = useState({
    department: employee?.department || '',
    job_title: employee?.job_title || '',
    employment_type: employee?.employment_type || '',
    start_date: employee?.start_date || '',
    manager_user_id: employee?.manager_user_id ? String(employee.manager_user_id) : '',
    emergency_contact_name: employee?.emergency_contact_name || '',
    emergency_contact_phone: employee?.emergency_contact_phone || '',
    profile_notes: employee?.profile_notes || '',
    status: employee?.employee_status || 'active',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      department: form.department.trim(),
      job_title: form.job_title.trim(),
      employment_type: form.employment_type || null,
      start_date: form.start_date || null,
      manager_user_id: form.manager_user_id ? Number(form.manager_user_id) : null,
      emergency_contact_name: form.emergency_contact_name.trim(),
      emergency_contact_phone: form.emergency_contact_phone.trim(),
      profile_notes: form.profile_notes.trim(),
      status: form.status,
    });
  };

  const managers = employees.filter((e) => e.user_id !== employee?.user_id);

  return (
    <Modal open onClose={loading ? undefined : onClose} title={`Profile — ${employee?.name}`} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Job title</span>
            <input className="input-field w-full" value={form.job_title} onChange={(e) => set('job_title', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Department</span>
            <input className="input-field w-full" value={form.department} onChange={(e) => set('department', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Employment type</span>
            <select className="admin-filter-select w-full" value={form.employment_type} onChange={(e) => set('employment_type', e.target.value)}>
              {EMP_TYPES.map((t) => (
                <option key={t.value || 'none'} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Start date</span>
            <input type="date" className="input-field w-full" value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Manager</span>
            <select className="admin-filter-select w-full" value={form.manager_user_id} onChange={(e) => set('manager_user_id', e.target.value)}>
              <option value="">None</option>
              {managers.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.name} ({m.staff_id})</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Emergency contact</span>
            <input className="input-field w-full" value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Emergency phone</span>
            <input className="input-field w-full" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Notes</span>
          <textarea className="input-field w-full min-h-[72px]" value={form.profile_notes} onChange={(e) => set('profile_notes', e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Employment status</span>
          <select className="admin-filter-select w-32" value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="flex justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">Cancel</button>
          {canManage && (
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Saving…' : 'Save profile'}</button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default function AdminEmployeesPage() {
  const user = useAuthStore((s) => s.user);
  const canView = hasAnyPermission(user, ['view_employees', 'manage_employee_profiles', 'manage_staff']);
  const canManage = hasPermission(user, 'manage_employee_profiles') || hasPermission(user, 'manage_staff');
  const { data: employees = [], isLoading } = useAdminEmployees(!!user && canView);
  const updateProfile = useUpdateEmployeeProfile();
  const [edit, setEdit] = useState(null);
  const [pageError, setPageError] = useState('');

  if (user && !canView) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const save = async (payload) => {
    if (!edit) return;
    setPageError('');
    try {
      await updateProfile.mutateAsync({ id: edit.employee_id, ...payload });
      setEdit(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not save profile.');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Employees"
        subtitle="Workforce profiles for staff, drivers, and station staff — linked to DPM-EMP IDs."
        actions={
          <Link to="/admin/leave-requests" className="btn-ghost text-sm">
            Leave requests →
          </Link>
        }
      />
      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {isLoading ? (
        <AdminTableSkeleton rows={5} cols={6} />
      ) : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'staff_id', label: 'Staff ID' },
            { key: 'role', label: 'Role' },
            { key: 'title', label: 'Job title' },
            { key: 'dept', label: 'Department' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {employees.map((e) => (
            <AdminTableRow key={e.employee_id}>
              <AdminTableCell className="font-bold">{e.name}</AdminTableCell>
              <AdminTableCell>
                <CopyableText value={e.staff_id} className="font-mono text-xs font-bold text-brand-green" title="Copy staff ID" />
              </AdminTableCell>
              <AdminTableCell className="capitalize text-muted">{e.role.replace('_', ' ')}</AdminTableCell>
              <AdminTableCell>{e.job_title || <span className="text-muted">—</span>}</AdminTableCell>
              <AdminTableCell className="text-muted">{e.department || '—'}</AdminTableCell>
              <AdminTableCell>
                <button type="button" onClick={() => setEdit(e)} className="text-xs font-bold text-brand-green">
                  {canManage ? 'Edit profile' : 'View'}
                </button>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      {edit && (
        <ProfileModal
          key={edit.employee_id}
          employee={edit}
          employees={employees}
          onClose={() => setEdit(null)}
          onSave={save}
          loading={updateProfile.isPending}
          canManage={canManage}
        />
      )}
    </div>
  );
}
