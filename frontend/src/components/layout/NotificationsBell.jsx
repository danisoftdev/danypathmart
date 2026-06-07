import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, TrashIcon } from '../icons';
import { useDeleteNotifications, useMarkNotificationsRead, useNotifications } from '../../hooks/notifications';
import { useAuthStore } from '../../store/authStore';
import { isAdminUser } from '../../lib/permissions';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function NotificationsBell() {
  const user = useAuthStore((s) => s.user);
  const isCustomer = user?.role === 'customer';
  const isAdmin = isAdminUser(user);
  const canShow = isCustomer || isAdmin;
  const viewAllPath = isAdmin ? '/admin/alerts' : '/dashboard/notifications';
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const deleteNotifications = useDeleteNotifications();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const ref = useRef(null);

  const items = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0;

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  if (!canShow) return null;

  const onOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) {
      markRead.mutate([]);
    }
  };

  const onItemClick = (id) => {
    if (id) markRead.mutate([id]);
    setOpen(false);
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((p) => p.id)));
    }
  };

  const toggleOne = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteOne = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteNotifications.mutateAsync({ singleId: id });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      /* query invalidation handles stale state */
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.5rem] z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-xl dark:border-white/10 dark:bg-[#1E1E1E] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(28rem,calc(100vw-2rem))] sm:max-h-[min(32rem,85vh)]">
          <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
            <h3 className="text-base font-bold">Notifications</h3>
            <Link
              to={viewAllPath}
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-brand-green hover:underline"
            >
              View all
            </Link>
          </div>
          {items.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-2 dark:border-white/10">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 accent-brand-green"
                  aria-label="Select all notifications"
                />
                Select all
              </label>
              {someSelected && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={deleteNotifications.isPending}
                  className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
                >
                  Delete ({selected.size})
                </button>
              )}
            </div>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {isLoading ? (
              <li className="px-4 py-6 text-center text-sm text-muted">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted">No notifications yet.</li>
            ) : (
              items.map((p) => {
                const isChecked = selected.has(p.id);
                const inner = (
                  <>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {!p.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-gold" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">{p.title}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted">{p.body}</p>
                    <p className="mt-1 text-[10px] text-muted">{formatWhen(p.created_at)}</p>
                  </>
                );

                const rowClass =
                  'group flex items-start gap-2 border-b border-black/5 px-3 py-3 transition hover:bg-brand-green/5 dark:border-white/5';

                return (
                  <li key={p.id} className={rowClass}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => toggleOne(p.id, e)}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-brand-green"
                      aria-label={`Select notification: ${p.title}`}
                    />
                    {p.link_url ? (
                      <Link
                        to={p.link_url}
                        onClick={() => onItemClick(p.id)}
                        className="min-w-0 flex-1"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1">{inner}</div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => deleteOne(p.id, e)}
                      disabled={deleteNotifications.isPending}
                      aria-label={`Delete notification: ${p.title}`}
                      className="shrink-0 rounded p-1 text-muted opacity-60 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-black/5 px-4 py-3 dark:border-white/10 sm:hidden">
            <Link
              to={viewAllPath}
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-green/10 text-sm font-bold text-brand-green"
            >
              Open full notifications page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
