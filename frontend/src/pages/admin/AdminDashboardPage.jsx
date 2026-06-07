import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  useAdminReports,
  useAlertCount,
  useCareerApplicationsCount,
  useContactInboxCount,
  useLaunchReadiness,
  useStaff,
} from '../../hooks/admin';
import { formatPrice } from '../../lib/currency';
import { hasAnyPermission, hasPermission, isAdminUser } from '../../lib/permissions';

const CAN_PILOT = ['view_company_settings', 'edit_company_settings'];
import { ADMIN_QUICK_ACTIONS } from '../../components/admin/AdminQuickBar';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import { AdminPageError, AdminPageLoading } from '../../components/admin/AdminFetchState';

/** Shortcut tiles — brand colours; stats cards above cover overlapping routes. */
const NAV_CARD_META = {
  '/admin/alerts': { icon: '🔔', hint: 'Order notifications', tone: 'gold' },
  '/admin/quotes': { icon: '📋', hint: 'Institutional quotes', tone: 'purple' },
  '/admin/hub-logistics': { icon: '🏭', hint: 'Hub receive & handoff', tone: 'green' },
  '/admin/delivery-runs': { icon: '🚐', hint: 'Driver runs', tone: 'orange' },
  '/admin/pickup-stations': { icon: '📍', hint: 'Pickup locations', tone: 'emerald' },
  '/admin/station-staff': { icon: '📦', hint: 'Station repack team', tone: 'rose' },
  '/admin/marketplace': { icon: '🏪', hint: 'Shops & listings', tone: 'gold' },
  '/admin/users': { icon: '👤', hint: 'Customer accounts', tone: 'emerald' },
  '/admin/reports': { icon: '📈', hint: 'Sales & exports', tone: 'purple' },
  '/admin/shipping': { icon: '🚚', hint: 'Rates & zones', tone: 'orange' },
  '/admin/contact-inbox': { icon: '✉️', hint: 'Contact messages', tone: 'rose' },
  '/admin/career-applications': { icon: '📝', hint: 'Applicants', tone: 'green' },
  '/admin/company-settings': { icon: '⚙️', hint: 'Company & modules', tone: 'neutral' },
};

const STAT_ROUTES = new Set([
  '/admin/orders',
  '/admin/products',
  '/admin/image-alerts',
  '/admin/staff',
]);

function navCardsForUser(user, badges) {
  return ADMIN_QUICK_ACTIONS.filter((item) => {
    if (item.to === '/admin/dashboard' || STAT_ROUTES.has(item.to)) return false;
    if (item.permissions?.length) return hasAnyPermission(user, item.permissions);
    if (item.permission) return hasPermission(user, item.permission);
    return true;
  }).map((item) => {
    const meta = NAV_CARD_META[item.to] || { icon: '↗', hint: 'Admin section', tone: 'neutral' };
    return {
      key: item.to,
      to: item.to,
      label: item.label,
      icon: meta.icon,
      change: meta.hint,
      tone: meta.tone,
      badge: item.badgeKey ? badges[item.badgeKey] ?? 0 : 0,
    };
  });
}

export default function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const alertsQuery = useAlertCount(true);
  const reportsQuery = useAdminReports();
  const staffQuery = useStaff(isSuperAdmin);
  const { data: inboxUnread = 0 } = useContactInboxCount(true);
  const { data: careersUnread = 0 } = useCareerApplicationsCount(true);
  const canPilot = user && hasAnyPermission(user, CAN_PILOT);
  const { data: launchReady } = useLaunchReadiness(!!canPilot);

  const alertData = alertsQuery.data;
  const reportData = reportsQuery.data;
  const staffData = staffQuery.data;

  const pendingAlerts = alertData?.pending_count ?? reportData?.pending_alerts ?? 0;
  const productTotal = reportData?.products_active ?? '—';
  const orderTotal = reportData?.orders_total ?? '—';
  const revenue = reportData?.revenue_paid;
  const staffCount = staffData?.data?.length ?? 0;

  const badges = useMemo(
    () => ({ alerts: pendingAlerts, inbox: inboxUnread, careers: careersUnread }),
    [pendingAlerts, inboxUnread, careersUnread]
  );

  const navCards = useMemo(() => navCardsForUser(user, badges), [user, badges]);

  const initialLoading =
    (reportsQuery.isPending && reportData == null)
    || (alertsQuery.isPending && alertData == null);

  const reportsFailed = reportsQuery.isError && reportData == null;

  return (
    <div>
      <AdminPageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle="Store overview — monitor alerts, catalogue and team access."
      />

      {canPilot && launchReady && !launchReady.ready && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <div>
            <p className="font-bold">P1 pilot — action needed</p>
            <p className="mt-1 text-sm text-muted">
              {launchReady.summary?.fail ?? 0} blocking check(s) · {launchReady.stats?.products_active ?? 0} active
              products
            </p>
          </div>
          <Link to="/admin/launch-readiness" className="btn-primary shrink-0 text-sm">
            Open checklist
          </Link>
        </div>
      )}

      {canPilot && launchReady?.ready && launchReady?.p2 && !launchReady.p2.ready && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <div>
            <p className="font-bold">P2 public launch — action needed</p>
            <p className="mt-1 text-sm text-muted">
              {launchReady.p2.summary?.fail ?? 0} blocking item(s) — legal policies, footer, or SEO files
            </p>
          </div>
          <Link to="/admin/launch-readiness" className="btn-primary shrink-0 text-sm">
            Open P2 checklist
          </Link>
        </div>
      )}

      {canPilot && launchReady?.ready && launchReady?.p2?.ready && !(launchReady?.p3?.ready && launchReady?.p4?.ready && launchReady?.p5?.ready) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <div>
            <p className="font-bold">Phase 2 — expand operations</p>
            <p className="mt-1 text-sm text-muted">
              Enable modules one at a time under Launch readiness → Phase 2
            </p>
          </div>
          <Link to="/admin/launch-readiness" className="btn-primary shrink-0 text-sm">
            Open Phase 2
          </Link>
        </div>
      )}

      {canPilot && launchReady?.p2?.ready && launchReady?.p3 && !launchReady.p3.ready && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <div>
            <p className="font-bold">P3 logistics & marketplace — action needed</p>
            <p className="mt-1 text-sm text-muted">
              {launchReady.p3.summary?.fail ?? 0} blocking item(s) — pickup, drivers, or marketplace setup
            </p>
          </div>
          <Link to="/admin/launch-readiness" className="btn-primary shrink-0 text-sm">
            Open P3 checklist
          </Link>
        </div>
      )}

      {canPilot && launchReady?.p3?.ready && launchReady?.p4 && !launchReady.p4.ready && launchReady.p4.hr_enabled && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <div>
            <p className="font-bold">P4 workforce HR — action needed</p>
            <p className="mt-1 text-sm text-muted">
              {launchReady.p4.summary?.fail ?? 0} blocking item(s) — employee profiles or leave settings
            </p>
          </div>
          <Link to="/admin/launch-readiness" className="btn-primary shrink-0 text-sm">
            Open P4 checklist
          </Link>
        </div>
      )}

      {canPilot && launchReady?.p4?.ready && launchReady?.p5 && !launchReady.p5.ready && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <div>
            <p className="font-bold">P5 quality & ops — action needed</p>
            <p className="mt-1 text-sm text-muted">
              {launchReady.p5.summary?.fail ?? 0} blocking item(s) — smoke tests, analytics, or monitoring setup
            </p>
          </div>
          <Link to="/admin/launch-readiness" className="btn-primary shrink-0 text-sm">
            Open P5 checklist
          </Link>
        </div>
      )}

      {initialLoading ? (
        <AdminPageLoading />
      ) : reportsFailed ? (
        <AdminPageError
          message="Could not load dashboard stats."
          detail={reportsQuery.error?.response?.data?.message}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard
            to="/admin/image-alerts"
            label="Pending image alerts"
            value={pendingAlerts}
            change={pendingAlerts > 0 ? 'Needs review' : 'All clear'}
            icon="🖼️"
            tone={pendingAlerts > 0 ? 'gold' : 'green'}
            badge={pendingAlerts}
          />
          <AdminStatCard
            to="/admin/orders"
            label="Total orders"
            value={orderTotal}
            change={revenue != null ? `Revenue ${formatPrice(revenue)}` : undefined}
            icon="📦"
            tone="orange"
          />
          <AdminStatCard
            to="/admin/products"
            label="Products in catalogue"
            value={productTotal}
            change="Active on storefront"
            icon="🏷️"
            tone="emerald"
          />
          {isSuperAdmin && (
            <AdminStatCard
              to="/admin/staff"
              label="Staff accounts"
              value={staffQuery.isError ? '—' : staffCount}
              change={staffQuery.isError ? 'Could not load staff' : 'With delegated access'}
              icon="👥"
              tone="purple"
            />
          )}
          <AdminStatCard
            to={isSuperAdmin ? '/admin/position-permissions' : '/admin/company-settings'}
            label="Your role"
            value={isSuperAdmin ? 'Super Admin' : 'Staff'}
            change="RBAC permissions active"
            icon="🔐"
            tone="green"
          />

          {navCards.map((card) => (
            <AdminStatCard
              key={card.key}
              to={card.to}
              label={card.label}
              change={card.change}
              icon={card.icon}
              tone={card.tone}
              variant="nav"
              badge={card.badge}
            />
          ))}

          <AdminStatCard
            to="/"
            label="Storefront"
            change="View customer site"
            icon="🛒"
            tone="emerald"
            variant="nav"
            external
          />
        </div>
      )}

      {!isAdminUser(user) && null}
    </div>
  );
}
