import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrashIcon } from '../../components/icons';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import {
  useDeleteNotifications,
  useNotifications,
  useMarkNotificationsRead,
} from '../../hooks/notifications';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso.replace(' ', 'T')).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const CATEGORY_LABEL = {
  admin_order: 'Order',
  admin_auth: 'Account',
  admin_contact: 'Contact',
  admin_quote: 'Quote',
  admin_alert: 'Alert',
};

export default function AdminAlertsPage() {
  const { data, isLoading, isError } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const deleteNotifications = useDeleteNotifications();
  const [selected, setSelected] = useState(() => new Set());

  const items = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0;

  useEffect(() => {
    if (unreadCount > 0) {
      markRead.mutate([]);
    }
  }, [unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <FormPanelSkeleton />;
  if (isError) {
    return <p className="text-brand-red">Could not load alerts.</p>;
  }

  return (
    <div>
      <AdminPageHeader
        title="Admin alerts"
        subtitle="Orders, sign-ins, contact messages, and other store activity."
      />

      {items.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(items.map((p) => p.id)))
              }
              className="h-4 w-4 accent-brand-green"
            />
            Select all
          </label>
          {someSelected && (
            <button
              type="button"
              onClick={() => deleteNotifications.mutateAsync({ ids: [...selected] }).then(() => setSelected(new Set()))}
              className="text-sm font-bold text-brand-red hover:underline"
            >
              Delete ({selected.size})
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-muted dark:border-white/15">
          No alerts yet. You will be notified here and by email when customers place orders, sign in, and more.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]"
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
                className="mt-1 h-4 w-4 accent-brand-green"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {!item.is_read && (
                    <span className="h-2 w-2 rounded-full bg-brand-gold" aria-hidden />
                  )}
                  <p className="font-bold">{item.title}</p>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase text-muted dark:bg-white/10">
                    {CATEGORY_LABEL[item.category] || item.category}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{item.body}</p>
                <p className="mt-2 text-xs text-muted">{formatWhen(item.created_at)}</p>
                {item.link_url && (
                  <Link to={item.link_url} className="mt-2 inline-block text-sm font-bold text-brand-green hover:underline">
                    Open →
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteNotifications.mutateAsync({ singleId: item.id })}
                aria-label="Delete"
                className="shrink-0 text-muted hover:text-brand-red"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
