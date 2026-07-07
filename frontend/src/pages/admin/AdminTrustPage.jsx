import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import {
  useAdminShopReports,
  useAdminTrustSettings,
  useIssueUserCaution,
  useResolveShopReport,
  useUpdateAdminTrustSettings,
} from '../../hooks/trust';

const REASON_LABELS = {
  no_delivery: 'No delivery',
  payment_ignored: 'Payment ignored',
  wrong_items: 'Wrong items',
  pricing_scam: 'Pricing scam',
  harassment: 'Harassment',
  counterfeit: 'Counterfeit',
  other: 'Other',
};

export default function AdminTrustPage() {
  const user = useAuthStore((s) => s.user);
  const canReports = hasPermission(user, 'resolve_shop_reports');
  const canAutomation = hasPermission(user, 'manage_trust_automation');
  const canCaution = hasPermission(user, 'issue_user_caution');

  const { data: reportsData, isLoading } = useAdminShopReports(undefined, canReports);
  const resolveReport = useResolveShopReport();
  const { data: trustSettings } = useAdminTrustSettings(canAutomation);
  const updateTrust = useUpdateAdminTrustSettings();
  const issueCaution = useIssueUserCaution();

  const [cautionForm, setCautionForm] = useState({ user_id: '', level: 'caution', message: '' });
  const [trustForm, setTrustForm] = useState(null);

  useEffect(() => {
    if (trustSettings) setTrustForm(trustSettings);
  }, [trustSettings]);

  const reports = reportsData?.reports ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Trust & shop reports</h1>
        <p className="mt-1 text-sm text-muted">Review customer reports and manage cautions.</p>
      </div>

      {canReports && (
        <section className="admin-panel p-4">
          <h2 className="font-bold">Shop reports</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-muted">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No reports.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-black/8 p-4 dark:border-white/10">
                  <p className="text-sm font-bold">
                    #{r.id} — {r.shop_name} — order #{r.order_id}
                  </p>
                  <p className="text-xs text-muted">
                    {REASON_LABELS[r.reason] || r.reason} · {r.status} · {r.reporter_name}
                  </p>
                  <p className="mt-2 text-sm">{r.description}</p>
                  {r.status === 'open' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-brand-green/15 px-3 py-1 text-xs font-bold text-brand-green"
                        onClick={() => resolveReport.mutate({ report_id: r.id, status: 'under_review' })}
                      >
                        Under review
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-black/5 px-3 py-1 text-xs font-bold dark:bg-white/10"
                        onClick={() => resolveReport.mutate({ report_id: r.id, status: 'dismissed' })}
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-brand-red/10 px-3 py-1 text-xs font-bold text-brand-red"
                        onClick={() => resolveReport.mutate({ report_id: r.id, status: 'resolved' })}
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canCaution && (
        <section className="admin-panel p-4">
          <h2 className="font-bold">Issue caution</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await issueCaution.mutateAsync({
                user_id: Number(cautionForm.user_id),
                level: cautionForm.level,
                message: cautionForm.message,
              });
              setCautionForm({ user_id: '', level: 'caution', message: '' });
            }}
          >
            <input
              className="rounded-xl border px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
              placeholder="User ID"
              value={cautionForm.user_id}
              onChange={(e) => setCautionForm((f) => ({ ...f, user_id: e.target.value }))}
              required
            />
            <select
              className="rounded-xl border px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
              value={cautionForm.level}
              onChange={(e) => setCautionForm((f) => ({ ...f, level: e.target.value }))}
            >
              <option value="notice">Notice</option>
              <option value="caution">Caution</option>
              <option value="final_warning">Final warning</option>
              <option value="restriction">Restriction</option>
              <option value="suspension">Suspension</option>
            </select>
            <textarea
              className="sm:col-span-2 rounded-xl border px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
              rows={3}
              placeholder="Message to user"
              value={cautionForm.message}
              onChange={(e) => setCautionForm((f) => ({ ...f, message: e.target.value }))}
              required
            />
            <button type="submit" className="btn-primary sm:col-span-2 min-h-[40px]">
              Send caution
            </button>
          </form>
        </section>
      )}

      {canAutomation && trustForm && (
        <section className="admin-panel p-4">
          <h2 className="font-bold">Automation & reminders</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              await updateTrust.mutateAsync(trustForm);
            }}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!trustForm.shop_subscription_reminder_enabled}
                onChange={(e) => setTrustForm((f) => ({ ...f, shop_subscription_reminder_enabled: e.target.checked }))}
              />
              Send subscription reminder emails (7d, 1d, expiry)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!trustForm.trust_automation_enabled}
                onChange={(e) => setTrustForm((f) => ({ ...f, trust_automation_enabled: e.target.checked }))}
              />
              Enable trust automation (auto-caution on repeated reports)
            </label>
            <button type="submit" className="btn-primary min-h-[40px]">
              Save settings
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
