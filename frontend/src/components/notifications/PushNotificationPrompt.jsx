import { useEffect, useState } from 'react';
import { useCatalogSettings } from '../hooks/catalogSettings';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushNotificationPrompt() {
  const user = useAuthStore((s) => s.user);
  const { data: catalog } = useCatalogSettings();
  const enabled = catalog?.messaging?.push_notifications_enabled !== false;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('dpm_push_dismissed') === '1');

  useEffect(() => {
    if (!user || !enabled || dismissed) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw-push.js');
        const { data } = await api.get('/public/push/vapid');
        if (!data.enabled || !data.vapid_public_key) return;
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.vapid_public_key),
        });
        await api.post('/public/push/subscribe', { subscription: sub.toJSON() });
        localStorage.setItem('dpm_push_dismissed', '1');
        setDismissed(true);
      } catch {
        /* optional — user may block */
      }
    })();
  }, [user, enabled, dismissed]);

  if (!user || !enabled || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-brand-green/30 bg-white p-4 shadow-lg dark:bg-[#1E1E1E] md:left-auto md:right-6">
      <p className="text-sm font-semibold">Enable order updates</p>
      <p className="mt-1 text-xs text-muted">Get push notifications when your order status changes.</p>
      <button
        type="button"
        className="mt-3 text-xs font-bold text-muted hover:underline"
        onClick={() => {
          localStorage.setItem('dpm_push_dismissed', '1');
          setDismissed(true);
        }}
      >
        Not now
      </button>
    </div>
  );
}
