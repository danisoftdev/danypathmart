import { useEffect, useState } from 'react';
import { useAdminFinancialReports, useAdminReports, useCompanySettings, useUpdateCompanySettings } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import FinancialBreakdown from '../../components/admin/FinancialBreakdown';
import { AdminPageError } from '../../components/admin/AdminFetchState';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { formatPrice } from '../../lib/currency';
import { DashboardStatsSkeleton } from '../../components/ui/Skeleton';
import { printFinancialReport } from '../../lib/reportsDocuments';
import { downloadAdminReportsExport, emailAdminOrdersExport } from '../../lib/ordersExport';
import { useCompanyStore } from '../../store/companyStore';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';

export default function AdminReportsPage() {
  const company = useCompanyStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const canEditSettings = hasPermission(user, 'edit_company_settings');
  const { data: settings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [exporting, setExporting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [scheduleErr, setScheduleErr] = useState('');
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyEmail, setWeeklyEmail] = useState('');

  const summaryQuery = useAdminReports();
  const financialQuery = useAdminFinancialReports();

  const summary = summaryQuery.data;
  const financial = financialQuery.data;
  const loading = (summaryQuery.isPending && !summary) || (financialQuery.isPending && !financial);
  const failed = (summaryQuery.isError && !summary) || (financialQuery.isError && !financial);

  useEffect(() => {
    if (!settings) return;
    setWeeklyEnabled(!!settings.weekly_orders_export_enabled);
    setWeeklyEmail(settings.weekly_orders_export_email || settings.email || '');
  }, [settings]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadAdminReportsExport();
    } catch {
      window.alert('Could not export report. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const printReport = () => {
    if (!summary || !financial) return;
    printFinancialReport(summary, financial, company);
  };

  const saveSchedule = async () => {
    if (!canEditSettings || !settings) return;
    setScheduleErr('');
    setScheduleMsg('');
    try {
      await updateSettings.mutateAsync({
        ...settings,
        weekly_orders_export_enabled: weeklyEnabled,
        weekly_orders_export_email: weeklyEmail.trim() || null,
      });
      setScheduleMsg('Scheduled export settings saved.');
      setTimeout(() => setScheduleMsg(''), 4000);
    } catch (err) {
      setScheduleErr(err.response?.data?.message || 'Could not save settings.');
    }
  };

  const emailNow = async () => {
    setEmailing(true);
    setScheduleErr('');
    setScheduleMsg('');
    try {
      const res = await emailAdminOrdersExport({ email: weeklyEmail.trim(), days: 7 });
      setScheduleMsg(res.message || 'Email sent.');
      setTimeout(() => setScheduleMsg(''), 5000);
    } catch (err) {
      setScheduleErr(err.response?.data?.message || 'Could not send email.');
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Reports & inventory"
        subtitle="Track sales, shipping fees, CBM costs, and your net interest after deductions."
        actions={
          !loading && !failed ? (
            <>
              <button
                type="button"
                onClick={printReport}
                className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-black/[0.03] dark:border-white/15 dark:bg-[#1E1E1E]"
              >
                Print report
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting}
                className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:bg-[#1E1E1E]"
              >
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </>
          ) : null
        }
      />

      {loading ? (
        <DashboardStatsSkeleton count={6} />
      ) : failed ? (
        <AdminPageError
          message="Could not load financial reports."
          detail={financialQuery.error?.response?.data?.message || summaryQuery.error?.response?.data?.message}
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AdminStatCard label="Total orders" value={summary.orders_total} icon="📦" tone="neutral" />
            <AdminStatCard label="Paid revenue" value={formatPrice(summary.revenue_paid)} icon="💰" tone="green" />
            <AdminStatCard label="Net interest" value={formatPrice(financial.interest.net_interest)} icon="📈" tone="green" />
            <AdminStatCard label="Shipping collected" value={formatPrice(financial.revenue.shipping_collected)} icon="🚚" tone="gold" />
            <AdminStatCard label="CBM cost" value={formatPrice(financial.deductions.cbm_cost)} icon="📐" tone="red" />
            <AdminStatCard label="Inventory value" value={formatPrice(financial.inventory.retail_value)} icon="🏷️" tone="neutral" />
          </div>

          <FinancialBreakdown data={financial} />

          <section className="admin-panel mt-8 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold">Scheduled orders export</h2>
              <p className="mt-1 text-sm text-muted">
                Email a CSV of orders from the last 7 days — manually or weekly via cron.
              </p>
            </div>

            {scheduleMsg && <AdminPageAlert variant="success">{scheduleMsg}</AdminPageAlert>}
            {scheduleErr && <AdminPageAlert variant="error">{scheduleErr}</AdminPageAlert>}

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={weeklyEnabled}
                onChange={(e) => setWeeklyEnabled(e.target.checked)}
                disabled={!canEditSettings}
                className="h-4 w-4 accent-brand-green"
              />
              Enable weekly email (Mondays via server cron)
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Recipient email</span>
                <input
                  className="input-field"
                  type="email"
                  value={weeklyEmail}
                  onChange={(e) => setWeeklyEmail(e.target.value)}
                  placeholder="accountant@example.com"
                  disabled={!canEditSettings}
                />
              </label>
              {settings?.weekly_orders_export_last_sent && (
                <p className="self-end text-xs text-muted">
                  Last weekly send: {new Date(settings.weekly_orders_export_last_sent).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canEditSettings && (
                <button
                  type="button"
                  onClick={saveSchedule}
                  disabled={updateSettings.isPending}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  {updateSettings.isPending ? 'Saving…' : 'Save schedule'}
                </button>
              )}
              <button
                type="button"
                onClick={emailNow}
                disabled={emailing || !weeklyEmail.trim()}
                className="btn-primary px-4 py-2 text-sm"
              >
                {emailing ? 'Sending…' : 'Email orders CSV now'}
              </button>
            </div>

            <p className="text-xs text-muted">
              Cron (Hostinger): <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">php backend/scripts/weekly-orders-export.php</code>{' '}
              — e.g. every Monday at 6:00 AM. Without SMTP, files are saved to <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">backend/storage/mail/</code>.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
