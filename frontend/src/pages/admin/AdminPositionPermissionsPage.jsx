import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import {
  usePositionPermissions,
  useUpdatePositionPermissions,
} from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import PermissionGrid from '../../components/admin/PermissionGrid';
import { PERMISSION_GROUPS, PERMISSION_LABELS, emptyPermissions } from '../../lib/permissions';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

export default function AdminPositionPermissionsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = hasAnyPermission(user, ['manage_staff', 'manage_position_permissions']);
  const { data = [], isLoading } = usePositionPermissions(canManage);
  const update = useUpdatePositionPermissions();

  const [editing, setEditing] = useState(null);
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [pageError, setPageError] = useState('');
  const [saved, setSaved] = useState('');

  if (user && !canManage) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const openEdit = (row) => {
    setEditing(row);
    setPermissions({ ...emptyPermissions(), ...row.permissions });
    setSaved('');
  };

  const save = async () => {
    if (!editing) return;
    setPageError('');
    setSaved('');
    try {
      await update.mutateAsync({ slug: editing.slug, permissions });
      setSaved(`Saved defaults for ${editing.label}.`);
      setEditing(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not save position permissions.');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Position permissions"
        subtitle="Set default admin access for each job role type. These apply when you hire someone from careers applications."
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />
      {saved && (
        <p className="mb-4 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
          {saved}
        </p>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={4} cols={2} />
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={row.slug} className="admin-panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{row.label}</p>
                <p className="text-xs text-muted">
                  {Object.values(row.permissions || {}).filter(Boolean).length} permission(s) enabled by default
                  {row.is_driver ? ' · Driver sign-up page' : ''}
                </p>
              </div>
              <button type="button" onClick={() => openEdit(row)} className="btn-ghost px-3 py-1.5 text-sm">
                Edit defaults
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold">Default permissions — {editing.label}</h2>
            <p className="mt-1 text-sm text-muted">Toggle every area of the system this position should access by default.</p>
            <div className="mt-4">
              <PermissionGrid
                permissions={permissions}
                onChange={setPermissions}
                groups={PERMISSION_GROUPS}
                labels={PERMISSION_LABELS}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
              <button type="button" onClick={save} disabled={update.isPending} className="btn-primary">
                {update.isPending ? 'Saving…' : 'Save defaults'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
