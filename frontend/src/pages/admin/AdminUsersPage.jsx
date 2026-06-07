import { useMemo, useState } from 'react';

import { useAdminUsers, useUpdateCustomerStatus } from '../../hooks/admin';

import AdminPageHeader from '../../components/admin/AdminPageHeader';

import AdminSearchBar from '../../components/admin/AdminSearchBar';

import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';

import AdminFilterBar, { AdminFilterSelect } from '../../components/admin/AdminFilterBar';

import ConfirmDialog from '../../components/admin/ConfirmDialog';

import AdminPageAlert from '../../components/admin/AdminPageAlert';

import { AdminTableSkeleton } from '../../components/ui/Skeleton';

import EmptyState from '../../components/ui/EmptyState';



export default function AdminUsersPage() {

  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [confirmTarget, setConfirmTarget] = useState(null);

  const [pageError, setPageError] = useState('');

  const updateStatus = useUpdateCustomerStatus();



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



  return (

    <div>

      <AdminPageHeader title="Customers" subtitle="View customer accounts and enable or disable access.">

        <div className="flex flex-wrap gap-3">

          <AdminSearchBar value={search} onChange={setSearch} placeholder="Search name or email…" className="flex-1 sm:max-w-xs" />

          <AdminFilterBar>

            <AdminFilterSelect value={statusFilter} onChange={setStatusFilter} label="Status">

              <option value="">All</option>

              <option value="verified">Verified</option>

              <option value="unverified">Unverified</option>

              <option value="disabled">Disabled</option>

            </AdminFilterSelect>

          </AdminFilterBar>

        </div>

      </AdminPageHeader>



      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />



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

                <button

                  type="button"

                  onClick={() => openToggleConfirm(u)}

                  disabled={updateStatus.isPending}

                  className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:border-brand-green"

                >

                  {u.status === 'disabled' ? 'Enable' : 'Disable'}

                </button>

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

    </div>

  );

}


