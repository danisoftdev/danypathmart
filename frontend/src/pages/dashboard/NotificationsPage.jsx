import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrashIcon } from '../../components/icons';
import DashboardSection from '../../components/dashboard/DashboardSection';
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

function categoryLabel(category) {
  const labels = {
    order_update: 'Order update',
    system: 'Account',
    promotion: 'Promotion',
    broadcast: 'Announcement',
  };
  return labels[category] || 'Notification';
}

export default function NotificationsPage() {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mark all read on first visit

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((p) => p.id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteOne = async (id) => {
    try {
      await deleteNotifications.mutateAsync({ singleId: id });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      /* invalidation handles stale state */
    }
  };

  const deleteSelected = async () => {
    if (!someSelected) return;
    try {
      await deleteNotifications.mutateAsync({ ids: [...selected] });
      setSelected(new Set());
    } catch {
      /* ignore */
    }
  };

  if (isLoading) {
    return (
      <DashboardSection title="Notifications" subtitle="Order updates, refunds, and announcements.">
        <FormPanelSkeleton sections={3} />
      </DashboardSection>
    );
  }

  if (isError) {
    return (
      <DashboardSection title="Notifications" subtitle="Order updates, refunds, and announcements.">
        <p className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          Could not load notifications. Please try again later.
        </p>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection
      title="Notifications"
      subtitle="Order updates, refunds, and store announcements — also sent to your email."
    >
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1E1E1E]">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-brand-green"
              aria-label="Select all notifications"
            />
            Select all
          </label>
          {someSelected && (
            <button
              type="button"
              onClick={deleteSelected}
              disabled={deleteNotifications.isPending}
              className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-bold text-brand-red hover:bg-brand-red/10 disabled:opacity-50"
            >
              Delete selected ({selected.size})
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
          <p className="text-4xl" aria-hidden>
            🔔
          </p>
          <p className="mt-3 font-bold">No notifications yet</p>
          <p className="mt-1 text-sm text-muted">
            When your order status changes or you receive store credit, you will see it here and in your email.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const isChecked = selected.has(p.id);
            const card = (
              <article
                className={[
                  'rounded-2xl border bg-white p-4 transition dark:bg-[#1E1E1E]',
                  !p.is_read ? 'border-brand-gold/40 shadow-sm' : 'border-black/8 dark:border-white/10',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-green"
                    aria-label={`Select notification: ${p.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!p.is_read && (
                        <span className="rounded-full bg-brand-gold/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-brand-gold">
                          New
                        </span>
                      )}
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted dark:bg-white/10">
                        {categoryLabel(p.category)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-base font-extrabold leading-snug sm:text-lg">{p.title}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{p.body}</p>
                    <p className="mt-3 text-xs font-medium text-muted">{formatWhen(p.created_at)}</p>
                    {p.link_url && (
                      <Link
                        to={p.link_url}
                        className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-green hover:underline"
                      >
                        View details →
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteOne(p.id)}
                    disabled={deleteNotifications.isPending}
                    aria-label={`Delete notification: ${p.title}`}
                    className="shrink-0 rounded-xl p-2 text-muted transition hover:bg-brand-red/10 hover:text-brand-red disabled:opacity-50"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </article>
            );

            return <li key={p.id}>{card}</li>;
          })}
        </ul>
      )}
    </DashboardSection>
  );
}
