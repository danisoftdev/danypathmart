import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDeleteStaff, useStaff } from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import AddEditStaffModal from '../../components/admin/AddEditStaffModal';

const STATUS_STYLES = {
  verified: 'bg-brand-green/15 text-brand-green',
  unverified: 'bg-brand-gold/20 text-amber-700',
  disabled: 'bg-red-500/15 text-red-500',
};

export default function StaffAccounts() {
  const role = useAuthStore((s) => s.user?.role);
  const { data, isLoading } = useStaff();
  const deleteStaff = useDeleteStaff();
  const [modal, setModal] = useState(null); // { staff } | { staff: null }
  const staff = data?.data ?? [];

  if (role && role !== 'super_admin') {
    return <Navigate to="/admin/image-alerts" replace />;
  }

  const remove = async (member) => {
    if (!window.confirm(`Remove staff account for ${member.name}? This cannot be undone.`)) return;
    try {
      await deleteStaff.mutateAsync(member.id);
    } catch {
      window.alert('Could not remove this account.');
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Staff Accounts</h1>
        <button
          type="button"
          onClick={() => setModal({ staff: null })}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90"
        >
          + Add staff
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1c1c1c]">
        {isLoading ? (
          <p className="p-8 text-center text-black/60 dark:text-white/60">Loading staff...</p>
        ) : staff.length === 0 ? (
          <p className="p-8 text-center text-black/60 dark:text-white/60">
            No staff accounts yet. Add one to delegate access.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/40 dark:border-white/10 dark:text-white/40">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3 hidden sm:table-cell">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">2FA</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="p-3 font-medium">{m.name}</td>
                  <td className="p-3 hidden text-black/60 sm:table-cell dark:text-white/60">{m.email}</td>
                  <td className="p-3">{m.role_name || '\u2014'}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[m.status] || ''}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={m.totp_enabled ? 'text-brand-green' : 'text-black/40 dark:text-white/40'}>
                      {m.totp_enabled ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setModal({ staff: m })}
                        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium hover:border-brand-green hover:text-brand-green dark:border-white/15"
                      >
                        Permissions
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(m)}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <AddEditStaffModal staff={modal.staff} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
