import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDeleteStaff, useStaff } from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AddEditStaffModal from '../../components/admin/AddEditStaffModal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import AdminStatCard from '../../components/admin/AdminStatCard';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import EmptyState from '../../components/ui/EmptyState';
import CopyableText from '../../components/ui/CopyableText';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

const STATUS_STYLES = {
  verified: 'bg-brand-green/15 text-brand-green',
  unverified: 'bg-brand-gold/20 text-amber-800 dark:text-brand-gold',
  disabled: 'bg-brand-red/15 text-brand-red',
};

export default function StaffAccounts() {
  const user = useAuthStore((s) => s.user);
  const canManageStaff = hasAnyPermission(user, ['manage_staff']);

  const { data, isPending, isError, error } = useStaff(canManageStaff);
  const deleteStaff = useDeleteStaff();
  const [modal, setModal] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [pageError, setPageError] = useState('');
  const staff = data?.data ?? [];

  if (user && !canManageStaff) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!user) {
    return <AdminTableSkeleton rows={4} cols={6} />;
  }

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setPageError('');
    try {
      await deleteStaff.mutateAsync(removeTarget.id);
      setRemoveTarget(null);
    } catch {
      setPageError('Could not remove this account.');
      setRemoveTarget(null);
    }
  };

  const with2fa = staff.filter((m) => m.totp_enabled).length;

  return (
    <div>
      <AdminPageHeader
        title="Staff accounts"
        subtitle="Delegate admin access with custom RBAC permissions."
        actions={
          <button type="button" onClick={() => setModal({ staff: null })} className="btn-primary min-h-[44px] px-5">
            + Add staff
          </button>
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {!isPending && staff.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Total staff" value={staff.length} icon="👥" tone="neutral" />
          <AdminStatCard label="2FA enabled" value={with2fa} icon="🔐" tone="green" />
          <AdminStatCard label="Super admin" value="You" icon="⭐" tone="gold" />
        </div>
      )}

      {(isPending && data == null) ? (
        <AdminTableSkeleton rows={4} cols={7} />
      ) : isError && data == null ? (
        <div className="admin-panel">
          <p className="font-bold text-brand-red">Could not load staff accounts.</p>
          <p className="mt-1 text-sm text-muted">{error?.response?.data?.message || 'Only super administrators can manage staff.'}</p>
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          title="No staff accounts"
          message="Add a staff member to delegate admin access with custom permissions."
          actionLabel="Add staff"
          onAction={() => setModal({ staff: null })}
        />
      ) : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'staff_id', label: 'Staff ID', className: 'hidden md:table-cell' },
            { key: 'email', label: 'Email', className: 'hidden sm:table-cell' },
            { key: 'role', label: 'Role' },
            { key: 'status', label: 'Status' },
            { key: '2fa', label: '2FA' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {staff.map((m) => (
            <AdminTableRow key={m.id}>
              <AdminTableCell className="font-bold">{m.name}</AdminTableCell>
              <AdminTableCell className="hidden md:table-cell">
                {m.staff_id ? (
                  <CopyableText value={m.staff_id} className="font-mono text-xs font-bold text-brand-green" title="Copy staff ID" />
                ) : (
                  <span className="text-muted">—</span>
                )}
              </AdminTableCell>
              <AdminTableCell className="hidden text-muted sm:table-cell">{m.email}</AdminTableCell>
              <AdminTableCell>{m.role_name || '—'}</AdminTableCell>
              <AdminTableCell>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_STYLES[m.status] || ''}`}>
                  {m.status}
                </span>
              </AdminTableCell>
              <AdminTableCell>
                <span className={m.totp_enabled ? 'font-bold text-brand-green' : 'text-muted'}>
                  {m.totp_enabled ? 'On' : 'Off'}
                </span>
              </AdminTableCell>
              <AdminTableCell>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setModal({ staff: m })} className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:border-brand-green">
                    Permissions
                  </button>
                  <button type="button" onClick={() => setRemoveTarget(m)} className="rounded-lg border border-brand-red/30 px-3 py-1.5 text-xs font-bold text-brand-red">
                    Delete
                  </button>
                </div>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      {modal && <AddEditStaffModal staff={modal.staff} onClose={() => setModal(null)} />}

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Remove staff account?"
        message={removeTarget ? `Remove staff account for ${removeTarget.name}? This cannot be undone.` : ''}
        confirmLabel="Remove"
        loading={deleteStaff.isPending}
      />
    </div>
  );
}
