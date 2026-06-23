import { useState } from 'react';
import { useAdminBroadcasts, useSendBroadcast } from '../../hooks/admin';
import { useMessagingSettings } from '../../hooks/messagingSettings';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';

const CATEGORIES = [
  { value: 'new_arrival', label: 'New arrivals' },
  { value: 'restock', label: 'Back in stock' },
  { value: 'out_of_stock', label: 'Out of stock alert' },
  { value: 'system', label: 'System update' },
  { value: 'custom', label: 'Custom message' },
];

export default function AdminNotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const canMessaging = hasPermission(user, 'manage_messaging_integrations');
  const { data: messagingData } = useMessagingSettings(canMessaging);
  const messaging = messagingData?.settings ?? {};
  const { data: history, isLoading } = useAdminBroadcasts();
  const send = useSendBroadcast();
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'custom',
    link_url: '',
    send_email: true,
    send_sms: false,
    send_whatsapp: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim() || !form.body.trim()) {
      return setError('Title and message are required.');
    }
    try {
      const res = await send.mutateAsync({
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        link_url: form.link_url.trim() || undefined,
        send_email: form.send_email,
        send_sms: form.send_sms,
        send_whatsapp: form.send_whatsapp,
      });
      setSuccess(res.message || 'Notification sent.');
      setForm({ title: '', body: '', category: 'custom', link_url: '', send_email: true, send_sms: false, send_whatsapp: false });
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send notification.');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Customer notifications"
        subtitle="Send updates to all verified customers — in the app and by email."
      />

      <AdminPageAlert message={error} onDismiss={() => setError('')} />
      {success && (
        <p className="mb-4 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-green">
          {success}
        </p>
      )}

      <form onSubmit={submit} className="admin-panel mb-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">New notification</p>
        <select
          className="admin-filter-select w-full max-w-xs"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          className="input-field w-full"
          placeholder="Title (e.g. New uniforms arrived)"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />
        <textarea
          className="input-field min-h-[120px] w-full resize-y"
          placeholder="Message for your customers…"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          required
        />
        <input
          className="input-field w-full"
          placeholder="Optional link (e.g. /shop?category=uniforms)"
          value={form.link_url}
          onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.send_email}
            onChange={(e) => setForm((f) => ({ ...f, send_email: e.target.checked }))}
            className="h-4 w-4 accent-brand-green"
          />
          Also send by email
        </label>
        {canMessaging && (
          <>
            <label className={`flex items-center gap-2 text-sm font-medium ${!messaging.sms_configured ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={form.send_sms}
                disabled={!messaging.sms_configured || !messaging.sms_api_enabled}
                onChange={(e) => setForm((f) => ({ ...f, send_sms: e.target.checked }))}
                className="h-4 w-4 accent-brand-green"
              />
              Also send SMS (API in .env + toggle in Messaging settings)
            </label>
            <label className={`flex items-center gap-2 text-sm font-medium ${!messaging.whatsapp_configured ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={form.send_whatsapp}
                disabled={!messaging.whatsapp_configured || !messaging.whatsapp_api_enabled}
                onChange={(e) => setForm((f) => ({ ...f, send_whatsapp: e.target.checked }))}
                className="h-4 w-4 accent-brand-green"
              />
              Also send WhatsApp (API in .env + toggle in Messaging settings)
            </label>
          </>
        )}
        <button type="submit" disabled={send.isPending} className="btn-primary">
          {send.isPending ? 'Sending…' : 'Send to all customers'}
        </button>
      </form>

      <div className="admin-panel">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Recent broadcasts</p>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : !history?.length ? (
          <p className="text-sm text-muted">No broadcasts sent yet.</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {history.map((b) => (
              <li key={b.id} className="py-3 first:pt-0">
                <p className="font-bold">{b.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{b.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {b.recipient_count} customers · {b.category.replace('_', ' ')}
                  {b.send_email ? ' · email' : ''} · {new Date(b.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
