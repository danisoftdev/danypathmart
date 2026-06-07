import { useMemo, useState } from 'react';
import {
  useAdminCareerApplication,
  useAdminCareerApplications,
  useDeleteCareerApplications,
  useMarkCareerApplicationRead,
} from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import HireEmployeeModal from '../../components/admin/HireEmployeeModal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import CopyableText from '../../components/ui/CopyableText';
import { careerFileUrl } from '../../lib/careers';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ApplicationDetailModal({ appId, canHire, onClose, onDelete, onHire }) {
  const { data: detail, isLoading } = useAdminCareerApplication(appId);
  const app = detail || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Application #{appId}</p>
            <h3 className="text-lg font-extrabold">{app?.job_title || '…'}</h3>
            {app?.job_type_label && <p className="text-sm text-muted">{app.job_type_label}</p>}
            {app?.is_hired && (
              <span className="mt-1 inline-block rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold text-brand-green">
                HIRED
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-muted" aria-label="Close">
            ×
          </button>
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : app ? (
          <>
            <p className="mt-3 text-xs text-muted">{formatWhen(app.created_at)}</p>
            {app.is_hired && app.hired_at && (
              <p className="mt-1 text-xs text-brand-green">Employee account created {formatWhen(app.hired_at)}</p>
            )}

            {app.responses?.length > 0 ? (
              <dl className="mt-4 space-y-3">
                {app.responses.map((r) => (
                  <div key={r.id} className="rounded-lg border border-black/8 px-3 py-2 dark:border-white/10">
                    <dt className="text-xs font-bold uppercase tracking-wide text-muted">{r.field_label}</dt>
                    <dd className="mt-1 text-sm">
                      {r.field_type === 'file' && r.file_path ? (
                        <a
                          href={careerFileUrl(r.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-brand-green hover:underline"
                        >
                          {r.file_name || 'Download file'}
                        </a>
                      ) : (
                        <span className="whitespace-pre-wrap">{r.value_text || '—'}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <>
                <p className="mt-3 text-sm">
                  <span className="font-semibold">{app.name}</span>
                  {' · '}
                  <CopyableText value={app.email} className="inline text-brand-green" title="Copy email" />
                </p>
                <p className="text-sm text-muted">{app.phone}{app.city ? ` · ${app.city}` : ''}</p>
                {app.cover_message && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{app.cover_message}</p>
                )}
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {canHire && !app.is_hired && (
                <button type="button" onClick={() => onHire(app)} className="btn-primary px-4 py-2 text-sm">
                  Hire & create login
                </button>
              )}
              {app.email && (
                <CopyableText value={app.email} className="btn-ghost px-4 py-2 text-sm hover:no-underline" title="Copy email">
                  Copy email
                </CopyableText>
              )}
              <button type="button" onClick={onDelete} className="rounded-xl border border-brand-red px-4 py-2 text-sm font-bold text-brand-red">
                Delete
              </button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-brand-red">Could not load application.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminCareerApplicationsPage() {
  const user = useAuthStore((s) => s.user);
  const canHire = hasAnyPermission(user, ['manage_staff', 'hire_employees']);

  const { data, isLoading, isError } = useAdminCareerApplications();
  const markRead = useMarkCareerApplicationRead();
  const deleteApps = useDeleteCareerApplications();

  const applications = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const [selected, setSelected] = useState(() => new Set());
  const [viewing, setViewing] = useState(null);
  const [hiring, setHiring] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pageError, setPageError] = useState('');

  const allSelected = applications.length > 0 && selected.size === applications.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(applications.map((a) => a.id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openApplication = async (app) => {
    setViewing(app);
    if (!app.is_read) {
      try {
        await markRead.mutateAsync({ ids: [app.id] });
      } catch {
        /* ignore */
      }
    }
  };

  const confirmSingleDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await deleteApps.mutateAsync({ ids: [deleteTarget.id] });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      if (viewing?.id === deleteTarget.id) setViewing(null);
      setDeleteTarget(null);
    } catch {
      setPageError('Could not delete application.');
      setDeleteTarget(null);
    }
  };

  const confirmBulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setPageError('');
    try {
      await deleteApps.mutateAsync({ ids });
      setSelected(new Set());
      if (viewing && ids.includes(viewing.id)) setViewing(null);
      setBulkDeleteOpen(false);
    } catch {
      setPageError('Could not delete selected applications.');
      setBulkDeleteOpen(false);
    }
  };

  const markSelectedRead = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      await markRead.mutateAsync({ ids });
    } catch {
      setPageError('Could not mark applications as read.');
    }
  };

  const closeHire = (hired) => {
    setHiring(null);
    if (hired) setViewing(null);
  };

  const toolbar = useMemo(
    () => (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-brand-green" />
          Select all
        </label>
        {someSelected && (
          <>
            <button type="button" onClick={markSelectedRead} className="btn-ghost px-3 py-2 text-sm">
              Mark read ({selected.size})
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="rounded-lg border border-brand-red/40 px-3 py-2 text-sm font-bold text-brand-red hover:bg-brand-red/10"
            >
              Delete selected ({selected.size})
            </button>
          </>
        )}
        {unreadCount > 0 && (
          <span className="ml-auto text-sm font-semibold text-brand-gold">{unreadCount} unread</span>
        )}
      </div>
    ),
    [allSelected, someSelected, selected.size, unreadCount]
  );

  return (
    <div>
      <AdminPageHeader
        title="Career applications"
        subtitle="Review applicants and hire them — create username, email login, and assign permissions."
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {toolbar}

      {isLoading ? (
        <AdminTableSkeleton rows={6} cols={4} />
      ) : isError ? (
        <p className="text-sm text-brand-red">Could not load applications.</p>
      ) : applications.length === 0 ? (
        <p className="admin-panel text-sm text-muted">No applications yet.</p>
      ) : (
        <ul className="space-y-2">
          {applications.map((a) => (
            <li
              key={a.id}
              className={`admin-panel flex flex-wrap items-start gap-3 p-4 ${!a.is_read ? 'border-brand-gold/40 bg-brand-gold/5' : ''}`}
            >
              <input
                type="checkbox"
                checked={selected.has(a.id)}
                onChange={() => toggleOne(a.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-brand-green"
                aria-label={`Select application from ${a.name}`}
              />
              <button type="button" onClick={() => openApplication(a)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  {!a.is_read && (
                    <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-black">NEW</span>
                  )}
                  {a.is_hired && (
                    <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold text-brand-green">HIRED</span>
                  )}
                  <p className="font-bold">{a.job_title}</p>
                  {a.job_type_label && (
                    <span className="text-xs font-semibold text-muted">{a.job_type_label}</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {a.name} · {a.phone} · {formatWhen(a.created_at)}
                </p>
                <p className="mt-1 line-clamp-2 text-sm">{a.cover_message}</p>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {canHire && !a.is_hired && (
                  <button
                    type="button"
                    onClick={() => setHiring(a)}
                    className="text-xs font-bold text-brand-green hover:underline"
                  >
                    Hire
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(a)}
                  className="text-xs font-bold text-brand-red hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <ApplicationDetailModal
          appId={viewing.id}
          canHire={canHire}
          onClose={() => setViewing(null)}
          onHire={(app) => {
            setViewing(null);
            setHiring(app);
          }}
          onDelete={() => {
            setDeleteTarget(viewing);
            setViewing(null);
          }}
        />
      )}

      {hiring && (
        <HireEmployeeModal application={hiring} onClose={closeHire} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmSingleDelete}
        title="Delete application?"
        message={deleteTarget ? `Delete the application from ${deleteTarget.name}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        loading={deleteApps.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Delete selected applications?"
        message={`Delete ${selected.size} selected application(s)? This cannot be undone.`}
        confirmLabel="Delete all"
        loading={deleteApps.isPending}
      />
    </div>
  );
}
