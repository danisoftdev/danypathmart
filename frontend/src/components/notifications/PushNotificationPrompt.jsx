import { useEffect, useState } from 'react';
import { useCatalogSettings } from '../../hooks/catalogSettings';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

const DISMISS_KEY = 'dpm_push_dismissed';

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

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(false);
  const [vapidKey, setVapidKey] = useState(null);

  useEffect(() => {
    if (!user || !enabled || dismissed) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }
    // Already blocked or already granted — no soft prompt needed.
    if (Notification.permission === 'denied') {
      dismiss();
      return;
    }
    if (Notification.permission === 'granted') {
      dismiss();
      return;
    }

    setSupported(true);

    (async () => {
      try {
        const { data } = await api.get('/public/push/vapid');
        if (!data?.enabled || !data?.vapid_public_key) {
          setSupported(false);
          return;
        }
        setVapidKey(data.vapid_public_key);
      } catch {
        setSupported(false);
      }
    })();
  }, [user, enabled, dismissed]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
  };

  const enable = async () => {
    if (busy || !vapidKey) return;
    setBusy(true);
    setError('');
    try {
      const reg = await navigator.serviceWorker.register('/sw-push.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        dismiss();
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await api.post('/public/push/subscribe', { subscription: sub.toJSON() });
      dismiss();
    } catch {
      setError('Could not enable notifications. Check browser settings.');
    } finally {
      setBusy(false);
    }
  };

  if (!user || !enabled || dismissed || !supported || !vapidKey) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-brand-green/30 bg-white p-4 shadow-lg dark:border-white/15 dark:bg-[#1E1E1E] md:bottom-6 md:left-auto md:right-6">
      <p className="text-sm font-semibold text-[#111111] dark:text-white">Enable order updates</p>
      <p className="mt-1 text-xs text-muted">Get push notifications when your order status changes.</p>
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className="btn-primary min-h-[40px] px-4 text-xs"
          disabled={busy}
          onClick={enable}
        >
          {busy ? 'Enabling…' : 'Enable'}
        </button>
        <button
          type="button"
          className="min-h-[40px] px-2 text-xs font-bold text-muted hover:underline"
          disabled={busy}
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
