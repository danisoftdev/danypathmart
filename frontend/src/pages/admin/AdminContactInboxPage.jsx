import { useMemo, useState } from 'react';
import {
  useAdminContactInbox,
  useDeleteContactMessages,
  useMarkContactRead,
} from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import CopyableText from '../../components/ui/CopyableText';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminContactInboxPage() {
  const { data, isLoading, isError } = useAdminContactInbox();
  const markRead = useMarkContactRead();
  const deleteMessages = useDeleteContactMessages();

  const messages = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const [selected, setSelected] = useState(() => new Set());
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pageError, setPageError] = useState('');

  const allSelected = messages.length > 0 && selected.size === messages.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(messages.map((m) => m.id)));
    }
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openMessage = async (msg) => {
    setViewing(msg);
    if (!msg.is_read) {
      try {
        await markRead.mutateAsync({ ids: [msg.id] });
      } catch {
        /* ignore */
      }
    }
  };

  const confirmSingleDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await deleteMessages.mutateAsync({ ids: [deleteTarget.id] });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      if (viewing?.id === deleteTarget.id) setViewing(null);
      setDeleteTarget(null);
    } catch {
      setPageError('Could not delete message.');
      setDeleteTarget(null);
    }
  };

  const confirmBulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setPageError('');
    try {
      await deleteMessages.mutateAsync({ ids });
      setSelected(new Set());
      if (viewing && ids.includes(viewing.id)) setViewing(null);
      setBulkDeleteOpen(false);
    } catch {
      setPageError('Could not delete selected messages.');
      setBulkDeleteOpen(false);
    }
  };

  const markSelectedRead = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      await markRead.mutateAsync({ ids });
    } catch {
      setPageError('Could not mark messages as read.');
    }
  };

  const toolbar = useMemo(
    () => (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 accent-brand-green"
          />
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
        title="Contact inbox"
        subtitle="Messages from the contact form — also emailed to your admin address."
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {toolbar}

      {isLoading ? (
        <AdminTableSkeleton rows={6} cols={4} />
      ) : isError ? (
        <p className="text-sm text-brand-red">Could not load inbox.</p>
      ) : messages.length === 0 ? (
        <p className="admin-panel text-sm text-muted">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`admin-panel flex flex-wrap items-start gap-3 p-4 ${!m.is_read ? 'border-brand-gold/40 bg-brand-gold/5' : ''}`}
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleOne(m.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-brand-green"
                aria-label={`Select message from ${m.name}`}
              />
              <button
                type="button"
                onClick={() => openMessage(m)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {!m.is_read && (
                    <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-black">NEW</span>
                  )}
                  <p className="font-bold">{m.subject || 'Contact form message'}</p>
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  {m.name} &lt;{m.email}&gt; · {formatWhen(m.created_at)}
                </p>
                <p className="mt-1 line-clamp-2 text-sm">{m.message}</p>
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(m)}
                className="shrink-0 text-xs font-bold text-brand-red hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Message #{viewing.id}</p>
                <h3 className="text-lg font-extrabold">{viewing.subject || 'Contact form message'}</h3>
              </div>
              <button type="button" onClick={() => setViewing(null)} className="text-2xl leading-none text-muted" aria-label="Close">
                ×
              </button>
            </div>
            <p className="mt-3 text-sm">
              <span className="font-semibold">{viewing.name}</span>
              {' · '}
              <CopyableText
                value={viewing.email}
                className="inline text-brand-green"
                title="Copy customer email"
              />
            </p>
            <p className="text-xs text-muted">{formatWhen(viewing.created_at)}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{viewing.message}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CopyableText
                value={viewing.email}
                className="btn-primary px-4 py-2 text-sm hover:no-underline"
                title="Copy email to reply in your mail app"
              >
                Copy email
              </CopyableText>
              <button
                type="button"
                onClick={() => {
                  setViewing(null);
                  setDeleteTarget(viewing);
                }}
                className="rounded-xl border border-brand-red px-4 py-2 text-sm font-bold text-brand-red"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmSingleDelete}
        title="Delete message?"
        message={deleteTarget ? `Delete the message from ${deleteTarget.name}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        loading={deleteMessages.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Delete selected messages?"
        message={`Delete ${selected.size} selected message(s)? This cannot be undone.`}
        confirmLabel="Delete all"
        loading={deleteMessages.isPending}
      />
    </div>
  );
}
