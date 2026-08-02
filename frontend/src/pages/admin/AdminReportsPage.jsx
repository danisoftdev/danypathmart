import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminFinancialReports, useAdminReports, useCompanySettings, useUpdateCompanySettings } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import FinancialBreakdown from '../../components/admin/FinancialBreakdown';
import { AdminPageError } from '../../components/admin/AdminFetchState';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { formatPrice } from '../../lib/currency';
import { DashboardStatsSkeleton } from '../../components/ui/Skeleton';
import { printFinancialReport, printInventoryList } from '../../lib/reportsDocuments';
import { downloadAdminReportsExport, emailAdminOrdersExport } from '../../lib/ordersExport';
import { useCompanyStore } from '../../store/companyStore';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/permissions';
import Modal from '../../components/dashboard/Modal';
import { useCategories } from '../../hooks/catalog';
import { flattenCategories } from '../../lib/categories';
import CategorySelect from '../../components/ui/CategorySelect';
import api from '../../lib/api';

const DEFAULT_SECTIONS = {
  overview: true,
  revenue: true,
  inventory: true,
  recent: true,
};

export default function AdminReportsPage() {
  const company = useCompanyStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const canEditSettings = hasPermission(user, 'edit_company_settings');
  const { data: settings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { data: catData } = useCategories();
  const categories = useMemo(() => flattenCategories(catData?.data || []), [catData]);

  const [exporting, setExporting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [scheduleErr, setScheduleErr] = useState('');
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyEmail, setWeeklyEmail] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [printSections, setPrintSections] = useState(DEFAULT_SECTIONS);
  const [invStock, setInvStock] = useState('');
  const [invStatus, setInvStatus] = useState('active');
  const [invCategory, setInvCategory] = useState('');
  const [printingInv, setPrintingInv] = useState(false);

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

  const runPrintReport = () => {
    if (!summary || !financial) return;
    printFinancialReport(summary, financial, company, printSections);
    setPrintOpen(false);
  };

  const printInventory = async () => {
    setPrintingInv(true);
    try {
      const { data } = await api.get('/admin/products', {
        params: {
          inventory: '1',
          stock_status: invStock || undefined,
          status: invStatus || undefined,
          category_id: invCategory || undefined,
        },
      });
      const labelParts = ['DPM inventory'];
      if (invStock === 'in_stock') labelParts.push('in stock');
      if (invStock === 'low') labelParts.push('low stock');
      if (invStock === 'out') labelParts.push('out of stock');
      if (invStatus) labelParts.push(invStatus);
      printInventoryList(data.data || [], company, { label: labelParts.join(' · ') });
    } catch {
      window.alert('Could not load inventory for printing.');
    } finally {
      setPrintingInv(false);
    }
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

  const toggleSection = (key) => {
    setPrintSections((s) => ({ ...s, [key]: !s[key] }));
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
                onClick={() => setPrintOpen(true)}
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
              <h2 className="text-lg font-extrabold">Print inventory list</h2>
              <p className="mt-1 text-sm text-muted">
                Choose stock filters, then print a count sheet. For reset inventory and product search filters, use{' '}
                <Link to="/admin/products" className="font-bold text-brand-green hover:underline">
                  Products
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select className="admin-filter-select" value={invStock} onChange={(e) => setInvStock(e.target.value)} aria-label="Stock filter">
                <option value="">All stock</option>
                <option value="in_stock">In stock</option>
                <option value="low">Low stock (≤5)</option>
                <option value="out">Out of stock</option>
              </select>
              <select className="admin-filter-select" value={invStatus} onChange={(e) => setInvStatus(e.target.value)} aria-label="Status filter">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
              <CategorySelect
                categories={categories}
                value={invCategory}
                onChange={setInvCategory}
                emptyLabel="All categories"
                className="admin-filter-select"
                aria-label="Category filter"
              />
              <button
                type="button"
                onClick={printInventory}
                disabled={printingInv}
                className="btn-primary px-4 py-2 text-sm"
              >
                {printingInv ? 'Preparing…' : 'Print inventory'}
              </button>
            </div>
          </section>

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

      {printOpen && (
        <Modal open onClose={() => setPrintOpen(false)} title="Print report — choose sections" maxWidth="max-w-md">
          <p className="mb-4 text-sm text-muted">Tick only what you want on the printed page.</p>
          <div className="space-y-3">
            {[
              ['overview', 'Overview (orders, revenue, customers)'],
              ['revenue', 'Revenue & interest'],
              ['inventory', 'Inventory summary'],
              ['recent', 'Recent paid orders'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={!!printSections[key]}
                  onChange={() => toggleSection(key)}
                  className="h-4 w-4 accent-brand-green"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => setPrintOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!Object.values(printSections).some(Boolean)}
              onClick={runPrintReport}
            >
              Print selected
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
