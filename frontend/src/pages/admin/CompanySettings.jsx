import { useState } from 'react';
import { useCompanySettings, useUpdateCompanySettings } from '../../hooks/admin';
import { FacebookIcon, InstagramIcon, TwitterIcon, WhatsAppIcon } from '../../components/icons';

const EMPTY = {
  company_name: '',
  email: '',
  phone: '',
  whatsapp_group: '',
  whatsapp_support: '',
  facebook: '',
  instagram: '',
  twitter: '',
  address: '',
  business_hours: '',
  return_policy: '',
  usd_to_ghs_rate: 0,
};

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-black/50 dark:text-white/50">{hint}</p>}
    </div>
  );
}

function SocialField({ icon: Icon, label, value, onChange, placeholder }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60">
          <Icon className="h-4 w-4" />
        </span>
        <input className="modal-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </div>
    </Field>
  );
}

function Section({ title, children }) {
  return (
    <div className="card-panel">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function CompanySettings() {
  const { data, isLoading } = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [form, setForm] = useState(EMPTY);
  const [seededAt, setSeededAt] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  // Hydrate the form once the server settings arrive (render-time sync).
  if (data && seededAt !== data.updated_at) {
    setSeededAt(data.updated_at ?? 'loaded');
    setForm({ ...EMPTY, ...data, usd_to_ghs_rate: data.usd_to_ghs_rate ?? 0 });
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const waNumber = String(form.whatsapp_support || '').replace(/\D/g, '');
  const rate = Number(form.usd_to_ghs_rate) || 0;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setToast('');
    if (!form.company_name.trim()) return setError('Company name is required.');
    try {
      await update.mutateAsync({ ...form, usd_to_ghs_rate: rate });
      setToast('Company settings saved.');
      setTimeout(() => setToast(''), 3000);
    } catch (e2) {
      setError(e2.response?.data?.message || 'Could not save settings.');
    }
  };

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />;
  }

  return (
    <form onSubmit={save}>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">Company Settings</h1>
        <button type="submit" className="btn-primary py-2 text-sm" disabled={update.isPending}>
          {update.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</p>}
      {toast && (
        <p className="mb-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-medium text-brand-green">{toast}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Basic info">
          <Field label="Company name">
            <input className="modal-input" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </Field>
          <Field label="Contact email">
            <input className="modal-input" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="modal-input" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </Section>

        <Section title="WhatsApp">
          <Field label="Group invite link">
            <div className="flex items-center gap-2">
              <input className="modal-input" value={form.whatsapp_group || ''} onChange={(e) => set('whatsapp_group', e.target.value)} placeholder="https://chat.whatsapp.com/..." />
              {form.whatsapp_group && (
                <a href={form.whatsapp_group} target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0 px-3 py-2 text-xs">
                  Preview
                </a>
              )}
            </div>
          </Field>
          <Field label="Support number" hint={waNumber ? `Customers reach you at wa.me/${waNumber}` : 'Digits only, including country code (e.g. 233201112222)'}>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-emerald/10 text-brand-emerald">
                <WhatsAppIcon className="h-4 w-4" />
              </span>
              <input className="modal-input" value={form.whatsapp_support || ''} onChange={(e) => set('whatsapp_support', e.target.value)} placeholder="233201112222" />
            </div>
          </Field>
        </Section>

        <Section title="Social">
          <SocialField icon={FacebookIcon} label="Facebook" value={form.facebook || ''} onChange={(v) => set('facebook', v)} placeholder="https://facebook.com/..." />
          <SocialField icon={InstagramIcon} label="Instagram" value={form.instagram || ''} onChange={(v) => set('instagram', v)} placeholder="https://instagram.com/..." />
          <SocialField icon={TwitterIcon} label="Twitter / X" value={form.twitter || ''} onChange={(v) => set('twitter', v)} placeholder="https://x.com/..." />
        </Section>

        <Section title="Address & hours">
          <Field label="Business address">
            <textarea
              className="modal-input min-h-[80px] resize-y"
              value={form.address || ''}
              onChange={(e) => set('address', e.target.value)}
            />
          </Field>
          <Field label="Business hours">
            <input className="modal-input" value={form.business_hours || ''} onChange={(e) => set('business_hours', e.target.value)} placeholder="Mon-Sat 8am-6pm" />
          </Field>
        </Section>

        <Section title="Financial">
          <Field label="USD to GHS rate" hint={rate > 0 ? `1 USD = ${rate} GHS \u00B7 $100 = ${(rate * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GHS` : 'Used to convert international freight costs.'}>
            <input
              className="modal-input"
              type="number"
              step="0.0001"
              min="0"
              value={form.usd_to_ghs_rate}
              onChange={(e) => set('usd_to_ghs_rate', e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Return policy">
          <Field label="Policy shown to customers">
            <textarea
              className="modal-input min-h-[120px] resize-y"
              value={form.return_policy || ''}
              onChange={(e) => set('return_policy', e.target.value)}
            />
          </Field>
        </Section>
      </div>

      <div className="mt-6">
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
