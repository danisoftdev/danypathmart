import { useState } from 'react';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  emptyPermissions,
} from '../../lib/permissions';
import { useCreateStaff, useUpdateStaffPermissions } from '../../hooks/admin';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition',
        checked ? 'bg-brand-green' : 'bg-black/15 dark:bg-white/20',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}

export default function AddEditStaffModal({ staff, onClose }) {
  const isEdit = !!staff;
  const createStaff = useCreateStaff();
  const updatePerms = useUpdateStaffPermissions();

  const [form, setForm] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    username: staff?.username || '',
    role_name: staff?.role_name || '',
    temp_password: '',
  });
  const [permissions, setPermissions] = useState(
    staff?.permissions ? { ...emptyPermissions(), ...staff.permissions } : emptyPermissions()
  );
  const [error, setError] = useState('');
  const [createdPassword, setCreatedPassword] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const togglePerm = (key) => (val) => setPermissions((p) => ({ ...p, [key]: val }));

  const pending = createStaff.isPending || updatePerms.isPending;

  const submit = async () => {
    setError('');
    try {
      if (isEdit) {
        await updatePerms.mutateAsync({
          id: staff.id,
          role_name: form.role_name,
          permissions,
        });
        onClose(true);
      } else {
        if (!form.name.trim() || !form.email.trim()) {
          setError('Name and email are required.');
          return;
        }
        const res = await createStaff.mutateAsync({
          name: form.name.trim(),
          email: form.email.trim(),
          username: form.username.trim() || undefined,
          role_name: form.role_name.trim() || 'Staff',
          temp_password: form.temp_password.trim() || undefined,
          permissions,
        });
        setCreatedPassword(res.temp_password || '');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save staff account.');
    }
  };

  // Success screen after creation (shows the temp password once).
  if (createdPassword) {
    return (
      <Shell onClose={() => onClose(true)} title="Staff account created">
        <p className="text-sm text-black/70 dark:text-white/70">
          A welcome email has been sent to <strong>{form.email}</strong>. Share the temporary
          password below if needed:
        </p>
        <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.03] p-4 text-center dark:border-white/15 dark:bg-white/[0.04]">
          <code className="text-lg font-bold text-brand-green">{createdPassword}</code>
        </div>
        <p className="mt-3 text-xs text-black/50 dark:text-white/50">
          The staff member should change this password and set up 2FA on first login.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => onClose(true)}
            className="rounded-lg bg-brand-green px-5 py-2 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onClose={() => onClose(false)} title={isEdit ? `Edit ${staff.name}` : 'Add staff account'}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input
            value={form.name}
            onChange={set('name')}
            disabled={isEdit}
            className="modal-input"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            disabled={isEdit}
            className="modal-input"
          />
        </Field>
        <Field label="Username (optional)">
          <input
            value={form.username}
            onChange={set('username')}
            disabled={isEdit}
            placeholder="auto-generated if blank"
            className="modal-input"
          />
        </Field>
        <Field label="Role name">
          <input
            value={form.role_name}
            onChange={set('role_name')}
            placeholder="e.g. Order Manager"
            className="modal-input"
          />
        </Field>
        {!isEdit && (
          <Field label="Temporary password (optional)">
            <input
              value={form.temp_password}
              onChange={set('temp_password')}
              placeholder="auto-generated if blank"
              className="modal-input"
            />
          </Field>
        )}
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        Permissions
      </h3>
      <div className="space-y-5">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-gold">
              {group.title}
            </p>
            <div className="space-y-2">
              {group.keys.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 dark:border-white/10"
                >
                  <span className="text-sm">{PERMISSION_LABELS[key]}</span>
                  <Toggle checked={!!permissions[key]} onChange={togglePerm(key)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => onClose(false)}
          className="rounded-lg border border-black/15 px-5 py-2 text-sm dark:border-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-brand-green px-5 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving...' : isEdit ? 'Save permissions' : 'Create staff'}
        </button>
      </div>
    </Shell>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

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
