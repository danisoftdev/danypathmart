import { useState } from 'react';
import { useMessagingSettings, useSendManualMessage, useUpdateMessagingSettings } from '../../hooks/messagingSettings';
import AdminPageAlert from '../admin/AdminPageAlert';

function StatusBadge({ configured, enabled, label }) {
  let tone = 'bg-black/5 text-muted dark:bg-white/10';
  let text = `${label}: off`;
  if (enabled && configured) {
    tone = 'bg-brand-green/15 text-brand-green';
    text = `${label}: on & ready`;
  } else if (enabled && !configured) {
    tone = 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    text = `${label}: on — add .env keys`;
  } else if (configured) {
    text = `${label}: configured, toggle off`;
  }
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{text}</span>;
}

function ToggleField({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 p-3 dark:border-white/10 ${disabled ? 'opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand-green"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default function AdminMessagingSettingsPanel() {
  const { data, isLoading } = useMessagingSettings();
  const update = useUpdateMessagingSettings();
  const sendManual = useSendManualMessage();
  const settings = data?.settings ?? {};
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [manual, setManual] = useState({
    user_id: '',
    phone: '',
    title: '',
    body: '',
    send_push: true,
    send_sms: false,
    send_whatsapp: false,
  });

  const draft = form ?? {
    push_notifications_enabled: settings.push_notifications_enabled !== false,
    sms_api_enabled: !!settings.sms_api_enabled,
    whatsapp_api_enabled: !!settings.whatsapp_api_enabled,
    vapid_public_key: settings.vapid_public_key || '',
    show_units_sold_badge: settings.show_units_sold_badge !== false,
    show_low_stock_exact: settings.show_low_stock_exact !== false,
    stock_decrement_on_payment: settings.stock_decrement_on_payment !== false,
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await update.mutateAsync(draft);
      setForm(null);
      setToast('Messaging settings saved.');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save messaging settings.');
    }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await sendManual.mutateAsync({
        user_id: manual.user_id ? Number(manual.user_id) : undefined,
        phone: manual.phone.trim() || undefined,
        title: manual.title.trim(),
        body: manual.body.trim(),
        send_push: manual.send_push,
        send_sms: manual.send_sms,
        send_whatsapp: manual.send_whatsapp,
      });
      setToast('Manual message sent.');
      setManual((m) => ({ ...m, title: '', body: '' }));
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send message.');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted">Loading messaging settings…</p>;
  }

  return (
    <div className="space-y-6">
      <AdminPageAlert message={error} onDismiss={() => setError('')} />
      {toast && (
        <p className="rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{toast}</p>
      )}

      <div className="admin-panel">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Channel status</h2>
        <p className="mb-4 text-sm text-muted">
          API keys live in <code className="text-xs">public_html/api/.env</code>. Toggles here control whether each channel is active.
        </p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label="Push" configured={!!settings.push_configured} enabled={!!draft.push_notifications_enabled} />
          <StatusBadge label="SMS" configured={!!settings.sms_configured} enabled={!!draft.sms_api_enabled} />
          <StatusBadge label="WhatsApp" configured={!!settings.whatsapp_configured} enabled={!!draft.whatsapp_api_enabled} />
        </div>
      </div>

      <form onSubmit={save} className="admin-panel space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Toggles</h2>
        <ToggleField
          label="Push notifications"
          hint="Browser pop-ups when users subscribed (needs VAPID keys)."
          checked={!!draft.push_notifications_enabled}
          onChange={(v) => setForm({ ...draft, push_notifications_enabled: v })}
        />
        <ToggleField
          label="SMS API"
          hint="Automatic + manual SMS when SMS_API_URL is in .env."
          checked={!!draft.sms_api_enabled}
          onChange={(v) => setForm({ ...draft, sms_api_enabled: v })}
        />
        <ToggleField
          label="WhatsApp API"
          hint="Automatic + manual WhatsApp when WHATSAPP_API_URL is in .env."
          checked={!!draft.whatsapp_api_enabled}
          onChange={(v) => setForm({ ...draft, whatsapp_api_enabled: v })}
        />
        <div>
          <label className="mb-1 block text-sm font-medium">VAPID public key (push)</label>
          <input
            className="modal-input font-mono text-xs"
            value={draft.vapid_public_key}
            onChange={(e) => setForm({ ...draft, vapid_public_key: e.target.value })}
            placeholder="Paste public key from generate-vapid-keys"
          />
        </div>
        <div className="border-t border-black/8 pt-4 dark:border-white/10">
          <p className="mb-3 text-xs font-bold uppercase text-muted">Catalog display</p>
          <ToggleField
            label="Show units sold badge"
            checked={!!draft.show_units_sold_badge}
            onChange={(v) => setForm({ ...draft, show_units_sold_badge: v })}
          />
          <ToggleField
            label="Show exact low stock count"
            checked={!!draft.show_low_stock_exact}
            onChange={(v) => setForm({ ...draft, show_low_stock_exact: v })}
          />
          <ToggleField
            label="Decrement stock on payment"
            checked={!!draft.stock_decrement_on_payment}
            onChange={(v) => setForm({ ...draft, stock_decrement_on_payment: v })}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save messaging settings'}
        </button>
      </form>

      <form onSubmit={submitManual} className="admin-panel space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Send test / manual message</h2>
        <p className="text-sm text-muted">Send to one customer by user ID or raw phone (233…).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="modal-input"
            placeholder="User ID (optional)"
            value={manual.user_id}
            onChange={(e) => setManual((m) => ({ ...m, user_id: e.target.value }))}
          />
          <input
            className="modal-input"
            placeholder="Phone if no user ID"
            value={manual.phone}
            onChange={(e) => setManual((m) => ({ ...m, phone: e.target.value }))}
          />
        </div>
        <input
          className="modal-input w-full"
          placeholder="Title"
          value={manual.title}
          onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))}
          required
        />
        <textarea
          className="modal-input min-h-[80px] w-full resize-y"
          placeholder="Message"
          value={manual.body}
          onChange={(e) => setManual((m) => ({ ...m, body: e.target.value }))}
          required
        />
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manual.send_push} onChange={(e) => setManual((m) => ({ ...m, send_push: e.target.checked }))} className="accent-brand-green" />
            Push + in-app
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manual.send_sms} onChange={(e) => setManual((m) => ({ ...m, send_sms: e.target.checked }))} className="accent-brand-green" />
            SMS
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manual.send_whatsapp} onChange={(e) => setManual((m) => ({ ...m, send_whatsapp: e.target.checked }))} className="accent-brand-green" />
            WhatsApp
          </label>
        </div>
        <button type="submit" className="btn-ghost border border-brand-green/40" disabled={sendManual.isPending}>
          {sendManual.isPending ? 'Sending…' : 'Send manual message'}
        </button>
      </form>

      <div className="admin-panel text-xs text-muted">
        <p className="font-bold text-brand-green">Universal .env example (any SMS provider)</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-3 dark:bg-white/5">{`SMS_API_URL=https://api.provider.com/v1/sms/send
SMS_API_KEY=your_secret
SMS_API_HEADERS={"Authorization":"Bearer {{api_key}}","Content-Type":"application/json"}
SMS_API_BODY={"to":"{{phone}}","message":"{{message}}"}
SMS_API_DRY_RUN=1

WHATSAPP_API_URL=https://graph.facebook.com/v21.0/PHONE_ID/messages
WHATSAPP_API_TOKEN=your_token
WHATSAPP_API_HEADERS={"Authorization":"Bearer {{api_key}}","Content-Type":"application/json"}
WHATSAPP_API_BODY={"messaging_product":"whatsapp","to":"{{phone}}","type":"text","text":{"body":"{{message}}"}}

VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:support@danypathmart.store`}</pre>
      </div>
    </div>
  );
}
