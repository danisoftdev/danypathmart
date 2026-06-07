import { useEffect, useState } from 'react';
import PermissionGrid from './PermissionGrid';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  emptyPermissions,
} from '../../lib/permissions';
import { useAdminPickupStations, useHireFromApplication, usePositionPermissions } from '../../hooks/admin';
import { DRIVER_ROLE_NOTE } from '../../lib/careers';

function Shell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1c1c1c]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-black/40 dark:text-white/40">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function HireEmployeeModal({ application, onClose }) {
  const hire = useHireFromApplication();
  const { data: positions = [] } = usePositionPermissions();
  const { data: stations = [] } = useAdminPickupStations(!!application);

  const isDriver = application?.job_type === 'driver';
  const isStation = application?.job_type === 'station_coordinator';

  const [form, setForm] = useState({
    name: application?.name || '',
    email: application?.email || '',
    username: '',
    role_name: application?.job_type_label || application?.job_title || '',
    temp_password: '',
    pickup_station_id: '',
  });
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [error, setError] = useState('');
  const [createdPassword, setCreatedPassword] = useState('');

  useEffect(() => {
    if (!application?.job_type) return;
    const match = positions.find((p) => p.slug === application.job_type);
    if (match?.permissions) {
      setPermissions({ ...emptyPermissions(), ...match.permissions });
    }
  }, [application?.job_type, positions]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (isStation && !form.pickup_station_id) {
      setError('Select a pickup station for this coordinator.');
      return;
    }
    try {
      const res = await hire.mutateAsync({
        applicationId: application.id,
        name: form.name.trim(),
        email: form.email.trim(),
        username: form.username.trim() || undefined,
        role_name: form.role_name.trim() || undefined,
        temp_password: form.temp_password.trim() || undefined,
        pickup_station_id: isStation ? Number(form.pickup_station_id) : undefined,
        permissions: isDriver || isStation ? undefined : permissions,
      });
      setCreatedPassword(res.temp_password || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create employee account.');
    }
  };

  if (createdPassword) {
    return (
      <Shell onClose={() => onClose(true)} title="Employee account created">
        <p className="text-sm text-muted">
          Login sent to <strong>{form.email}</strong>. Share these credentials if needed:
        </p>
        <dl className="mt-4 space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
          {hire.data?.staff?.staff_id && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Staff ID</dt>
              <dd className="font-mono font-bold text-brand-green">{hire.data.staff.staff_id}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Username</dt>
            <dd className="font-bold">{hire.data?.staff?.username}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Temporary password</dt>
            <dd className="font-bold text-brand-green">{createdPassword}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => onClose(true)} className="btn-primary mt-6 w-full py-2">
          Done
        </button>
      </Shell>
    );
  }

  return (
    <Shell onClose={() => onClose(false)} title={`Hire — ${application?.name || 'Applicant'}`}>
      {error && (
        <p className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</p>
      )}
      <p className="mb-4 text-sm text-muted">
        Position: <strong>{application?.job_type_label || application?.job_title}</strong>.
        {isDriver && <> {DRIVER_ROLE_NOTE}</>}
        {isStation && <> Creates a <strong>/station</strong> portal login for repack & customer release.</>}
        {!isDriver && !isStation && ' Permissions below default from the position template — adjust before creating the account.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Full name</span>
          <input className="input-field w-full" value={form.name} onChange={set('name')} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Email (login)</span>
          <input type="email" className="input-field w-full" value={form.email} onChange={set('email')} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Username</span>
          <input className="input-field w-full" value={form.username} onChange={set('username')} placeholder="Auto if blank" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Position / role name</span>
          <input className="input-field w-full" value={form.role_name} onChange={set('role_name')} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold">Temporary password</span>
          <input className="input-field w-full" value={form.temp_password} onChange={set('temp_password')} placeholder="Auto-generated if blank" />
        </label>
        {isStation && (
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold">Pickup station</span>
            <select className="input-field w-full" value={form.pickup_station_id} onChange={set('pickup_station_id')} required>
              <option value="">Select station</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!isDriver && !isStation && (
        <>
          <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Permissions</h3>
          <PermissionGrid
            permissions={permissions}
            onChange={setPermissions}
            groups={PERMISSION_GROUPS}
            labels={PERMISSION_LABELS}
          />
        </>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={() => onClose(false)} className="btn-ghost">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={hire.isPending} className="btn-primary">
          {hire.isPending ? 'Creating…' : 'Create employee account'}
        </button>
      </div>
    </Shell>
  );
}
