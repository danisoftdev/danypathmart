import { useMemo, useState } from 'react';
import { useAdminUsers, useDeleteAdminUser, useUpdateCustomerStatus } from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import AdminFilterBar, { AdminFilterSelect } from '../../components/admin/AdminFilterBar';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import PromptDialog from '../../components/admin/PromptDialog';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

export default function AdminUsersPage() {
  const authUser = useAuthStore((s) => s.user);
  const canDelete = hasAnyPermission(authUser, ['delete_accounts', 'edit_users', 'edit_company_settings']);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const updateStatus = useUpdateCustomerStatus();
  const deleteUser = useDeleteAdminUser();

  const params = useMemo(
    () => ({ search: search.trim() || undefined, status: statusFilter || undefined }),
    [search, statusFilter]
  );
  const { data: users, isLoading, isError } = useAdminUsers(params);

  const openToggleConfirm = (user) => {
    const enabling = user.status === 'disabled';
    setConfirmTarget({
      user,
      nextStatus: enabling ? 'verified' : 'disabled',
      title: enabling ? 'Enable account?' : 'Disable account?',
      message: enabling
        ? `Enable account for ${user.name}? They will be able to sign in again.`
        : `Disable account for ${user.name}? They will no longer be able to sign in.`,
      confirmLabel: enabling ? 'Enable' : 'Disable',
      variant: enabling ? 'primary' : 'danger',
    });
  };

  const confirmToggle = async () => {
    if (!confirmTarget) return;
    setPageError('');
    try {
      await updateStatus.mutateAsync({ id: confirmTarget.user.id, status: confirmTarget.nextStatus });
      setConfirmTarget(null);
    } catch {
      setPageError('Could not update customer status.');
      setConfirmTarget(null);
    }
  };

  const confirmDelete = async (typedEmail) => {
    if (!userToDelete) return;
    setPageError('');
    setPageSuccess('');
    try {
      await deleteUser.mutateAsync({ id: userToDelete.id, confirm_email: typedEmail });
      setPageSuccess(`Deleted ${userToDelete.email}.`);
      setUserToDelete(null);
    } catch (e) {
      setPageError(e.response?.data?.message || 'Could not delete account.');
    }
  };

  return (
    <div>
      <AdminPageHeader title="Customers" subtitle="View, disable, or permanently delete customer accounts.">
        <div className="flex flex-wrap gap-3">
          <AdminSearchBar value={search} onChange={setSearch} placeholder="Search name or email…" className="flex-1 sm:max-w-xs" />
          <AdminFilterBar>
            <AdminFilterSelect value={statusFilter} onChange={setStatusFilter} label="Status">
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="disabled">Disabled</option>
              <option value="pending_deletion">Pending deletion</option>
            </AdminFilterSelect>
          </AdminFilterBar>
        </div>
      </AdminPageHeader>

      <AdminPageAlert message={pageError} type="error" onDismiss={() => setPageError('')} />
      <AdminPageAlert message={pageSuccess} type="success" onDismiss={() => setPageSuccess('')} />

      {isLoading ? (
        <AdminTableSkeleton rows={6} cols={5} />
      ) : isError ? (
        <p className="text-sm text-brand-red">Could not load customers.</p>
      ) : !users?.length ? (
        <EmptyState title="No customers found" message="Registered shoppers will appear here." />
      ) : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email', className: 'hidden sm:table-cell' },
            { key: 'status', label: 'Status' },
            { key: 'joined', label: 'Joined', className: 'hidden md:table-cell' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {users.map((u) => (
            <AdminTableRow key={u.id}>
              <AdminTableCell className="font-bold">{u.name}</AdminTableCell>
              <AdminTableCell className="hidden text-muted sm:table-cell">{u.email}</AdminTableCell>
              <AdminTableCell>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold capitalize dark:bg-white/10">{u.status}</span>
              </AdminTableCell>
              <AdminTableCell className="hidden text-muted md:table-cell">{u.created_at}</AdminTableCell>
              <AdminTableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openToggleConfirm(u)}
                    disabled={updateStatus.isPending || deleteUser.isPending}
                    className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:border-brand-green"
                  >
                    {u.status === 'disabled' ? 'Enable' : 'Disable'}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setUserToDelete(u)}
                      disabled={deleteUser.isPending}
                      className="rounded-lg border border-brand-red px-3 py-1.5 text-xs font-bold text-brand-red"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={confirmToggle}
        title={confirmTarget?.title}
        message={confirmTarget?.message}
        confirmLabel={confirmTarget?.confirmLabel}
        variant={confirmTarget?.variant}
        loading={updateStatus.isPending}
      />

      <PromptDialog
        open={!!userToDelete}
        onClose={() => !deleteUser.isPending && setUserToDelete(null)}
        onSubmit={confirmDelete}
        title="Delete customer permanently"
        description={
          userToDelete
            ? `This permanently deletes "${userToDelete.name}" (${userToDelete.email}) from the database.\n\nThey can register again later with the same email.\n\nThis cannot be undone.`
            : ''
        }
        label="Type the customer email exactly to confirm"
        expectedValue={userToDelete?.email ?? null}
        submitLabel="Delete account"
        loading={deleteUser.isPending}
        variant="danger"
      />
    </div>
  );
}
