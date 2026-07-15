import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  useAdminPickupStations,
  useAdminStationStaff,
  useCreateStationStaff,
  useDeleteStationStaff,
} from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import PromptDialog from '../../components/admin/PromptDialog';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import CopyableText from '../../components/ui/CopyableText';

function CreateStaffModal({ stations, onClose, onCreated }) {
  const create = useCreateStationStaff();
  const [form, setForm] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    pickup_station_id: '',
    temp_password: '',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await create.mutateAsync({
        ...form,
        pickup_station_id: Number(form.pickup_station_id),
      });
      setResult(res);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create account.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !create.isPending && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold">Add station staff</h2>
        {result ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold text-brand-green">Account created.</p>
            {result.staff?.staff_id && (
              <p>
                Staff ID:{' '}
                <CopyableText value={result.staff.staff_id} className="font-mono font-bold text-brand-green" title="Copy staff ID" />
              </p>
            )}
            <p>Portal: /station after login</p>
            <p className="rounded-lg bg-black/5 p-3 font-mono text-xs dark:bg-white/10">
              Temp password: {result.temp_password}
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            {error && <p className="text-sm font-semibold text-brand-red">{error}</p>}
            <input className="input-field w-full" placeholder="Full name" value={form.name} onChange={set('name')} required />
            <input className="input-field w-full" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
            <select className="input-field w-full" value={form.pickup_station_id} onChange={set('pickup_station_id')} required>
              <option value="">Assign pickup station</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
              ))}
            </select>
            <input className="input-field w-full" placeholder="Username (optional)" value={form.username} onChange={set('username')} />
            <input className="input-field w-full" placeholder="Phone" value={form.phone} onChange={set('phone')} />
            <input className="input-field w-full" placeholder="Temp password (optional)" value={form.temp_password} onChange={set('temp_password')} />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={create.isPending} className="btn-primary">
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminStationStaffPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = hasAnyPermission(user, ['manage_station_staff', 'edit_company_settings']);
  const canDelete = hasAnyPermission(user, ['delete_accounts', 'manage_station_staff', 'edit_company_settings']);
  const [showCreate, setShowCreate] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [alert, setAlert] = useState('');
  const [alertType, setAlertType] = useState('error');
  const { data: staff = [], isLoading } = useAdminStationStaff(canManage);
  const { data: stations = [] } = useAdminPickupStations(canManage);
  const deleteStaff = useDeleteStationStaff();

  if (!canManage) return <Navigate to="/admin/dashboard" replace />;

  return (
    <div>
      <AdminPageHeader
        title="Station staff"
        subtitle="Pickup coordinators repack into DPM packaging and release orders to customers (Phase M8)."
        actions={
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary" disabled={stations.length === 0}>
            Add staff
          </button>
        }
      />

      <AdminPageAlert message={alert} type={alertType} onDismiss={() => setAlert('')} />

      {stations.length === 0 && (
        <AdminPageAlert message="Add at least one pickup station before creating station staff accounts." />
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={4} />
      ) : staff.length === 0 ? (
        <EmptyState
          title="No station staff yet"
          message="Hire from career applications (station coordinator role) or add accounts here. Staff use /station after login."
        />
      ) : (
        <ul className="space-y-2">
          {staff.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1E1E1E]"
            >
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-sm text-muted">
                  {s.staff_id && (
                    <CopyableText value={s.staff_id} className="mr-2 font-mono text-xs font-bold text-brand-green" title="Copy staff ID" />
                  )}
                  {s.email} · {s.station_name || 'No station'}
                </p>
              </div>
              {canDelete && (
                <button
                  type="button"
                  className="text-xs font-bold text-brand-red hover:underline"
                  onClick={() => setStaffToDelete(s)}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateStaffModal
          stations={stations}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}

      <PromptDialog
        open={!!staffToDelete}
        onClose={() => !deleteStaff.isPending && setStaffToDelete(null)}
        onSubmit={async (typedEmail) => {
          if (!staffToDelete) return;
          try {
            await deleteStaff.mutateAsync({ id: staffToDelete.id, confirm_email: typedEmail });
            setAlert(`Deleted ${staffToDelete.email}.`);
            setAlertType('success');
            setStaffToDelete(null);
          } catch (e) {
            setAlert(e.response?.data?.message || 'Could not delete station staff.');
            setAlertType('error');
          }
        }}
        title="Delete station staff"
        description={
          staffToDelete
            ? `Permanently delete "${staffToDelete.name}" (${staffToDelete.email})?\n\nThis cannot be undone.`
            : ''
        }
        label="Type the email exactly to confirm"
        expectedValue={staffToDelete?.email ?? null}
        submitLabel="Delete account"
        loading={deleteStaff.isPending}
        variant="danger"
      />
    </div>
  );
}
