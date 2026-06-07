import { useEffect, useRef } from 'react';
import { useNotifications } from '../../hooks/notifications';
import { useAuthStore } from '../../store/authStore';
import { isAdminUser } from '../../lib/permissions';

/** Desktop / mobile push toasts when new admin alerts arrive. */
export default function AdminNotificationWatcher() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminUser(user);
  const { data } = useNotifications();
  const seenIds = useRef(new Set());
  const asked = useRef(false);

  useEffect(() => {
    if (!isAdmin || typeof window === 'undefined' || !('Notification' in window)) return;
    if (asked.current || Notification.permission !== 'default') return;
    asked.current = true;
    Notification.requestPermission().catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const items = data?.data ?? [];
    for (const item of items) {
      if (item.is_read || seenIds.current.has(item.id)) continue;
      seenIds.current.add(item.id);
      const toast = new Notification(item.title, {
        body: (item.body || '').slice(0, 240),
        tag: `dpm-admin-${item.id}`,
      });
      toast.onclick = () => {
        window.focus();
        if (item.link_url) {
          window.location.assign(item.link_url);
        }
      };
      break;
    }
  }, [data, isAdmin]);

  return null;
}
