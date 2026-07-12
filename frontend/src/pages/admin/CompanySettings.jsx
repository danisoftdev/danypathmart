import { useState } from 'react';
import { useCompanySettings, useUpdateCompanySettings } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { FacebookIcon, InstagramIcon, TwitterIcon, WhatsAppIcon } from '../../components/icons';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';
import { AdminPageError } from '../../components/admin/AdminFetchState';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import AdminMessagingSettingsPanel from '../../components/admin/AdminMessagingSettingsPanel';
import LocationMapPicker from '../../components/map/LocationMapPicker';

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
  latitude: null,
  longitude: null,
  business_hours: '',
  return_policy: '',
  usd_to_ghs_rate: 0,
  paystack_enabled: true,
  wallet_checkout_enabled: false,
  bank_transfer_enabled: false,
  pod_enabled: false,
  pay_before_delivery: true,
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  exchange_enabled: true,
  exchange_within_days: 7,
  exchange_policy_note: '',
  quotes_enabled: true,
  institutional_pay_later_enabled: true,
  repeat_club_discount_enabled: false,
  repeat_club_discount_mode: 'percent',
  repeat_club_discount_percent: 5,
  referral_credit_enabled: false,
  referral_credit_amount: 10,
  by_air_label_enabled: true,
  careers_enabled: false,
  driver_hiring_enabled: false,
  pickup_stations_enabled: false,
  marketplace_enabled: false,
  shop_applications_open: false,
  default_shop_commission_percent: 10,
  shop_earnings_release_on: 'collected',
  driver_module_enabled: false,
  station_repack_module_enabled: false,
  shop_referral_commission_enabled: false,
  subscription_referral_percent: 15,
  subscription_referral_sources: 'both',
  shop_referral_bonus_amount: 50,
  shop_referral_sales_target: 10,
  shop_referral_count_on: 'collected',
  leave_requests_enabled: false,
  default_annual_leave_days: 21,
  analytics_enabled: false,
  google_analytics_id: '',
  uptime_monitor_url: '',
  shop_billing_enabled: false,
  shop_registration_fee_ghs: 0,
  shop_renewal_fee_ghs: 0,
  shop_renewal_period: 'yearly',
  shop_renewal_grace_days: 7,
  image_search_enabled: false,
  vision_api_configured: false,
};

const TABS = [
  { id: 'storefront', label: 'Storefront & footer' },
  { id: 'payments', label: 'Payments' },
  { id: 'features', label: 'Features & modules' },
  { id: 'messaging', label: 'Messaging & push', permission: 'manage_messaging_integrations' },
];

/** Read-only API fields — do not send back on save. */
const READ_ONLY_KEYS = new Set([
  'vision_api_configured',
  'id',
  'updated_at',
  'updated_by',
  'weekly_orders_export_last_sent',
  'has_map_pin',
  'directions_url',
]);

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
    <div className="admin-panel">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function CompanySettings() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageShopFees = hasPermission(user, 'manage_shop_fees');
  const canManageImageSearch = hasPermission(user, 'manage_image_search');
  const canManageMessaging = hasPermission(user, 'manage_messaging_integrations');
  const { data, isLoading, error: fetchError } = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [draft, setDraft] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('storefront');

  const form = draft ?? (data ? { ...EMPTY, ...data, usd_to_ghs_rate: data.usd_to_ghs_rate ?? 0 } : EMPTY);

  const set = (key, value) => setDraft((prev) => ({ ...(prev ?? form), [key]: value }));

  const waNumber = String(form.whatsapp_support || '').replace(/\D/g, '');
  const rate = Number(form.usd_to_ghs_rate) || 0;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setToast('');
    if (!form.company_name.trim()) return setError('Company name is required.');
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([key]) => !READ_ONLY_KEYS.has(key))
      );
      await update.mutateAsync({ ...payload, usd_to_ghs_rate: rate });
      setDraft(null);
      setToast('Company settings saved.');
      setTimeout(() => setToast(''), 3000);
    } catch (e2) {
      setError(e2.response?.data?.message || 'Could not save settings.');
    }
  };

  if (isLoading && !data) {
    return <FormPanelSkeleton sections={3} />;
  }

  if (!data) {
    const status = fetchError?.response?.status;
    const apiMessage = fetchError?.response?.data?.message;
    const apiCode = fetchError?.response?.data?.code;
    const detail = apiMessage
      || (apiCode === 'deploy_incomplete'
        ? 'Backend deploy is incomplete — merge to main and run GitHub Deploy, or git pull on the server so api/helpers/CompanySettingsService.php exists.'
        : null)
      || (status === 401 ? 'Session expired — log in again (2FA required).' : null)
      || (status === 403 ? 'You need view_company_settings permission.' : null)
      || (status === 500 ? 'Internal server error — deploy latest API files and run migrations on the server.' : null)
      || (status ? `HTTP ${status}` : fetchError?.message);
    return (
      <AdminPageError
        message="Could not load company settings."
        detail={detail}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Company settings"
        subtitle={tab === 'messaging' ? 'Push, SMS, WhatsApp toggles and manual test sends.' : 'Store identity, contact channels, rates and policies shown to customers.'}
        actions={
          tab !== 'messaging' ? (
            <button type="submit" form="company-settings-form" className="btn-primary min-h-[44px] px-6" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-black/8 pb-1 dark:border-white/10">
        {TABS.filter((t) => !t.permission || hasPermission(user, t.permission)).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? 'border border-b-0 border-black/10 bg-white text-brand-green dark:border-white/15 dark:bg-[#1E1E1E]'
                : 'text-muted hover:text-brand-green'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

    {tab !== 'messaging' ? (
    <form id="company-settings-form" onSubmit={save}>
      {error && <p className="mb-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}
      {toast && (
        <p className="mb-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{toast}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {tab === 'storefront' && (
          <>
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
          <p className="-mt-2 text-xs text-muted">
            Shown in the site footer under <strong>Connect</strong> — save here, then check the homepage footer.
          </p>
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
          <Field label="HQ location on map" hint="Shown on Contact and for directions to DanyPathMart.">
            <LocationMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={({ latitude, longitude }) => {
                setDraft((prev) => ({ ...(prev ?? form), latitude, longitude }));
              }}
              height={260}
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

        <Section title="Return policy (legacy)">
          <p className="-mt-2 text-xs text-muted">
            Prefer <strong>Admin → Legal policies</strong> for returns, privacy, and terms (<code>/policies/…</code>). This field is only used if no published &quot;returns&quot; policy exists.
          </p>
          <Field label="Policy shown to customers">
            <textarea
              className="modal-input min-h-[120px] resize-y"
              value={form.return_policy || ''}
              onChange={(e) => set('return_policy', e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Wrong-size exchanges">
          <p className="-mt-2 text-xs text-muted">
            Shown at checkout when customers review their order. Helps build trust for uniforms and sized items.
          </p>
          <ToggleField
            label="Enable exchange policy at checkout"
            hint="When off, no exchange banner is shown."
            checked={!!form.exchange_enabled}
            onChange={(v) => set('exchange_enabled', v)}
          />
          {form.exchange_enabled && (
            <>
              <Field label="Exchange window (days after delivery)">
                <input
                  className="modal-input"
                  type="number"
                  min="1"
                  max="365"
                  value={form.exchange_within_days ?? 7}
                  onChange={(e) => set('exchange_within_days', Math.max(1, Number(e.target.value) || 7))}
                />
              </Field>
              <Field
                label="Custom checkout message (optional)"
                hint={`Leave blank to use: Wrong size? Exchange within ${form.exchange_within_days ?? 7} days…`}
              >
                <textarea
                  className="modal-input min-h-[80px] resize-y"
                  value={form.exchange_policy_note || ''}
                  onChange={(e) => set('exchange_policy_note', e.target.value)}
                  placeholder="Wrong size? Exchange within 7 days of delivery (uniforms & sized items)."
                />
              </Field>
            </>
          )}
        </Section>
          </>
        )}

        {tab === 'features' && (
          <>
        <Section title="Club loyalty">
          <p className="-mt-2 text-xs text-muted">
            Light, on-brand perks for returning clubs — no points or gamification.
          </p>
          <ToggleField
            label="Repeat club discount"
            hint="Applies when the same leader places a second paid group order for the same organization."
            checked={!!form.repeat_club_discount_enabled}
            onChange={(v) => set('repeat_club_discount_enabled', v)}
          />
          {form.repeat_club_discount_enabled && (
            <>
              <Field label="Discount type">
                <select
                  className="modal-input"
                  value={form.repeat_club_discount_mode || 'percent'}
                  onChange={(e) => set('repeat_club_discount_mode', e.target.value)}
                >
                  <option value="percent">Percentage off subtotal</option>
                  <option value="free_local_delivery">Free local delivery</option>
                </select>
              </Field>
              {form.repeat_club_discount_mode !== 'free_local_delivery' && (
                <Field label="Discount percent">
                  <input
                    className="modal-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.repeat_club_discount_percent ?? 5}
                    onChange={(e) => set('repeat_club_discount_percent', Number(e.target.value) || 0)}
                  />
                </Field>
              )}
            </>
          )}
          <ToggleField
            label="Refer a club leader"
            hint="Leaders share a code; wallet credit when a referred club completes their first paid order."
            checked={!!form.referral_credit_enabled}
            onChange={(v) => set('referral_credit_enabled', v)}
          />
          {form.referral_credit_enabled && (
            <Field label="Wallet credit amount (GHS)">
              <input
                className="modal-input"
                type="number"
                min="0"
                step="0.01"
                value={form.referral_credit_amount ?? 10}
                onChange={(e) => set('referral_credit_amount', Number(e.target.value) || 0)}
              />
            </Field>
          )}
        </Section>

        <Section title="Platform modules (Phase M1+)">
          <p className="-mt-2 text-xs text-muted">
            Turn features on as you roll out careers, pickup stations, marketplace shops, and drivers. Off by default except By air labelling.
          </p>
          <ToggleField
            label="By air product labels"
            hint="Customer-facing copy says “By air” instead of “Pre-order” (internal flag stays is_preorder)."
            checked={form.by_air_label_enabled !== false}
            onChange={(v) => set('by_air_label_enabled', v)}
          />
          <ToggleField
            label="Careers page"
            hint="Public /careers with job posts and applications."
            checked={!!form.careers_enabled}
            onChange={(v) => set('careers_enabled', v)}
          />
          <ToggleField
            label="Driver hiring on careers"
            hint="Show driver roles (hub to pickup station — no riders)."
            checked={!!form.driver_hiring_enabled}
            onChange={(v) => set('driver_hiring_enabled', v)}
            disabled={!form.careers_enabled}
          />
          <ToggleField
            label="Pickup stations"
            hint="Customers choose a pickup point at checkout (Phase M3)."
            checked={!!form.pickup_stations_enabled}
            onChange={(v) => set('pickup_stations_enabled', v)}
          />
          <ToggleField
            label="Marketplace / shops"
            hint="Third-party sellers and shop dashboards (Phase M4)."
            checked={!!form.marketplace_enabled}
            onChange={(v) => set('marketplace_enabled', v)}
          />
          <ToggleField
            label="Open shop applications"
            hint="Allow new shops to apply when marketplace is enabled."
            checked={!!form.shop_applications_open}
            onChange={(v) => set('shop_applications_open', v)}
            disabled={!form.marketplace_enabled}
          />
          {form.marketplace_enabled && (
            <>
              <Field
                label="Default shop commission (%)"
                hint="Platform fee taken from each marketplace sale before seller payout."
              >
                <input
                  className="modal-input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.default_shop_commission_percent ?? 10}
                  onChange={(e) => set('default_shop_commission_percent', Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Release seller earnings when order is">
                <select
                  className="modal-input"
                  value={form.shop_earnings_release_on || 'collected'}
                  onChange={(e) => set('shop_earnings_release_on', e.target.value)}
                >
                  <option value="collected">Collected / delivered (recommended)</option>
                  <option value="paid">Paid (immediate after payment)</option>
                </select>
              </Field>
            </>
          )}
          {canManageShopFees && form.marketplace_enabled && (
            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-gold">Shop billing (Paystack)</p>
              <ToggleField
                label="Charge shop registration & renewal fees"
                hint="When on, new shops pay a registration fee on apply and renew on a monthly or yearly cycle."
                checked={!!form.shop_billing_enabled}
                onChange={(v) => set('shop_billing_enabled', v)}
              />
              {form.shop_billing_enabled && (
                <>
                  <Field label="Registration fee (GHS)">
                    <input
                      className="modal-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.shop_registration_fee_ghs ?? 0}
                      onChange={(e) => set('shop_registration_fee_ghs', Number(e.target.value) || 0)}
                    />
                  </Field>
                  <Field label="Renewal fee (GHS)">
                    <input
                      className="modal-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.shop_renewal_fee_ghs ?? 0}
                      onChange={(e) => set('shop_renewal_fee_ghs', Number(e.target.value) || 0)}
                    />
                  </Field>
                  <Field label="Renewal period">
                    <select
                      className="modal-input"
                      value={form.shop_renewal_period || 'yearly'}
                      onChange={(e) => set('shop_renewal_period', e.target.value)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </Field>
                  <Field label="Grace days after expiry" hint="Shop stays visible briefly after renewal date before listing is hidden.">
                    <input
                      className="modal-input"
                      type="number"
                      min="0"
                      max="90"
                      value={form.shop_renewal_grace_days ?? 7}
                      onChange={(e) => set('shop_renewal_grace_days', Math.max(0, Number(e.target.value) || 0))}
                    />
                  </Field>
                </>
              )}
            </div>
          )}
          <ToggleField
            label="Driver logistics module"
            hint="Hub runs and driver assignment (Phase M7)."
            checked={!!form.driver_module_enabled}
            onChange={(v) => set('driver_module_enabled', v)}
          />
          <ToggleField
            label="Station repack module"
            hint="Pickup staff repack into DPM bags (Phase M8)."
            checked={!!form.station_repack_module_enabled}
            onChange={(v) => set('station_repack_module_enabled', v)}
          />
          <ToggleField
            label="Subscription referral program"
            hint="Promoters and shops earn a % of the first registration fee when they refer a new shop. Renewals and product sales do not pay referrers."
            checked={!!form.shop_referral_commission_enabled}
            onChange={(v) => set('shop_referral_commission_enabled', v)}
            disabled={!form.marketplace_enabled}
          />
          {form.shop_referral_commission_enabled && form.marketplace_enabled && isSuperAdmin && (
            <>
              <Field label="Registration referral %" hint="Super admin only — % of first subscription payment paid to referrer once.">
                <input
                  className="modal-input w-32"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.subscription_referral_percent ?? 15}
                  onChange={(e) => set('subscription_referral_percent', Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Who can refer new shops">
                <select
                  className="modal-input"
                  value={form.subscription_referral_sources || 'both'}
                  onChange={(e) => set('subscription_referral_sources', e.target.value)}
                >
                  <option value="both">Promoters and shop owners</option>
                  <option value="promoter">Promoters only</option>
                  <option value="shop">Shop owners only</option>
                </select>
              </Field>
            </>
          )}
          {false && form.shop_referral_commission_enabled && form.marketplace_enabled && (
            <>
              <Field label="Referral bonus (GHS)" hint="One-time credit to the referring shop’s wallet.">
                <input
                  className="modal-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shop_referral_bonus_amount ?? 50}
                  onChange={(e) => set('shop_referral_bonus_amount', Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Qualifying sales target">
                <input
                  className="modal-input"
                  type="number"
                  min="1"
                  max="1000"
                  value={form.shop_referral_sales_target ?? 10}
                  onChange={(e) => set('shop_referral_sales_target', Math.max(1, Number(e.target.value) || 10))}
                />
              </Field>
              <Field label="Count a sale when order is">
                <select
                  className="modal-input"
                  value={form.shop_referral_count_on || 'collected'}
                  onChange={(e) => set('shop_referral_count_on', e.target.value)}
                >
                  <option value="collected">Collected / delivered (recommended)</option>
                  <option value="paid">Paid</option>
                </select>
              </Field>
            </>
          )}
        </Section>

        <Section title="Workforce HR (P4)">
          <p className="-mt-2 text-xs text-muted">
            Employee profiles and leave requests — manage under{' '}
            <strong>Employees</strong> and <strong>Leave requests</strong> in the admin sidebar.
          </p>
          <ToggleField
            label="Leave requests"
            hint="Track annual, sick, and other leave with approve/reject workflow."
            checked={!!form.leave_requests_enabled}
            onChange={(v) => set('leave_requests_enabled', v)}
          />
          {form.leave_requests_enabled && (
            <Field label="Default annual leave (days)" hint="Reference allowance for HR — shown in launch readiness.">
              <input
                className="modal-input w-32"
                type="number"
                min="1"
                max="365"
                value={form.default_annual_leave_days ?? 21}
                onChange={(e) => set('default_annual_leave_days', Math.max(1, Number(e.target.value) || 21))}
              />
            </Field>
          )}
        </Section>

        <Section title="Quality & ops (P5)">
          <p className="-mt-2 text-xs text-muted">
            Storefront analytics, uptime monitoring, and post-launch smoke tests. Error alerts use{' '}
            <code className="text-[11px]">SENTRY_DSN</code> in the API <code className="text-[11px]">.env</code>.
          </p>
          <ToggleField
            label="Google Analytics (GA4)"
            hint="Loads gtag on the storefront when a measurement ID is set. Respects published traffic only."
            checked={!!form.analytics_enabled}
            onChange={(v) => set('analytics_enabled', v)}
          />
          {form.analytics_enabled && (
            <Field label="Measurement ID" hint="GA4 format: G-XXXXXXXXXX (from Google Analytics admin).">
              <input
                className="modal-input max-w-xs font-mono uppercase"
                type="text"
                placeholder="G-XXXXXXXXXX"
                value={form.google_analytics_id ?? ''}
                onChange={(e) => set('google_analytics_id', e.target.value.trim().toUpperCase())}
              />
            </Field>
          )}
          <Field label="Uptime monitor URL" hint="Optional — link to UptimeRobot, Better Stack, or similar for your team.">
            <input
              className="modal-input"
              type="url"
              placeholder="https://uptimerobot.com/dashboard/..."
              value={form.uptime_monitor_url ?? ''}
              onChange={(e) => set('uptime_monitor_url', e.target.value.trim())}
            />
          </Field>
        </Section>

        {canManageImageSearch && (
          <Section title="Image search">
            <p className="-mt-2 text-xs text-muted">
              Lets customers search by photo (Google Cloud Vision). Requires{' '}
              <code className="text-[11px]">GOOGLE_VISION_API_KEY</code> in the API{' '}
              <code className="text-[11px]">.env</code> with billing enabled. The camera icon appears on the storefront
              only when both this toggle and the API are ready.
            </p>
            <ToggleField
              label="Enable image search"
              hint={
                form.vision_api_configured
                  ? 'Vision API key detected on the server.'
                  : 'Server key not detected yet — you can save this toggle now; customers will see search once Vision is configured.'
              }
              checked={!!form.image_search_enabled}
              onChange={(v) => set('image_search_enabled', v)}
            />
            {form.image_search_enabled && form.vision_api_configured && (
              <p className="text-xs font-semibold text-brand-green">Live on storefront — camera search is available.</p>
            )}
            {form.image_search_enabled && !form.vision_api_configured && (
              <p className="text-xs font-semibold text-brand-gold">
                Saved as enabled — storefront will activate automatically when Vision billing and API key are ready.
              </p>
            )}
          </Section>
        )}

          </>
        )}

        {tab === 'payments' && (
          <>
        <Section title="Group & institutional buying">
          <ToggleField
            label="Quote / proforma requests"
            hint="Clubs and schools can request formal quotes from the group order page."
            checked={form.quotes_enabled !== false}
            onChange={(v) => set('quotes_enabled', v)}
          />
          <ToggleField
            label="Institutional pay-later"
            hint="Approve proformas as invoice orders — customer pays by bank transfer later."
            checked={form.institutional_pay_later_enabled !== false}
            onChange={(v) => set('institutional_pay_later_enabled', v)}
          />
        </Section>

        <Section title="Payments & checkout">
          <p className="-mt-2 text-xs text-muted">
            Customers pay in GHS. Only enabled methods appear at checkout. Pay-before-delivery is recommended.
          </p>
          <ToggleField
            label="Paystack (card & mobile money)"
            hint="Active at checkout today."
            checked={!!form.paystack_enabled}
            onChange={(v) => set('paystack_enabled', v)}
          />
          <ToggleField
            label="Wallet at checkout"
            hint="Customers can pay with store credit — full or partial, remainder via Paystack."
            checked={!!form.wallet_checkout_enabled}
            onChange={(v) => set('wallet_checkout_enabled', v)}
          />
          <ToggleField
            label="Bank transfer"
            hint="Customer submits a transfer reference; you confirm payment in Orders."
            checked={!!form.bank_transfer_enabled}
            onChange={(v) => set('bank_transfer_enabled', v)}
          />
          {form.bank_transfer_enabled && (
            <div className="space-y-3 rounded-xl border border-black/8 p-4 dark:border-white/10">
              <Field label="Bank name">
                <input
                  className="modal-input"
                  value={form.bank_name || ''}
                  onChange={(e) => set('bank_name', e.target.value)}
                  placeholder="e.g. GCB Bank"
                />
              </Field>
              <Field label="Account name">
                <input
                  className="modal-input"
                  value={form.bank_account_name || ''}
                  onChange={(e) => set('bank_account_name', e.target.value)}
                />
              </Field>
              <Field label="Account number">
                <input
                  className="modal-input font-mono"
                  value={form.bank_account_number || ''}
                  onChange={(e) => set('bank_account_number', e.target.value)}
                />
              </Field>
            </div>
          )}
          <ToggleField
            label="Pay on delivery"
            hint="Cash to courier — customers see clear pay-the-driver copy at checkout."
            checked={!!form.pod_enabled}
            onChange={(v) => set('pod_enabled', v)}
          />
          <ToggleField
            label="Pay before delivery (required)"
            hint="Orders must be paid before preparing or shipping. Blocks unpaid status updates."
            checked={form.pay_before_delivery !== false}
            onChange={(v) => set('pay_before_delivery', v)}
          />
        </Section>
          </>
        )}
      </div>

      <div className="mt-6 lg:col-span-2">
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
    ) : (
      canManageMessaging ? (
        <AdminMessagingSettingsPanel />
      ) : (
        <p className="text-sm text-muted">You need manage_messaging_integrations permission.</p>
      )
    )}
    </>
  );
}
