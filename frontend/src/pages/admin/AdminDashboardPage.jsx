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
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import { AdminPageError, AdminPageLoading } from '../../components/admin/AdminFetchState';

/** Grouped shortcut tiles — avoid duplicating the stats cards above. */
const NAV_GROUPS = [
  {
    title: 'Sell & fulfil',
    items: [
      { to: '/admin/quotes', label: 'Quotes', hint: 'Institutional quotes', icon: '📋', tone: 'purple', permissions: ['view_quotes', 'view_orders'] },
      { to: '/admin/shipping', label: 'Shipping', hint: 'Rates & zones', icon: '🚚', tone: 'orange', permission: 'manage_shipping' },
      { to: '/admin/hub-logistics', label: 'Hub logistics', hint: 'Receive & handoff', icon: '🏭', tone: 'green', permissions: ['manage_hub_logistics', 'edit_company_settings'] },
      { to: '/admin/delivery-runs', label: 'Delivery runs', hint: 'Driver runs', icon: '🚐', tone: 'orange', permissions: ['manage_delivery_runs', 'edit_company_settings'] },
      { to: '/admin/pickup-stations', label: 'Pickup stations', hint: 'Locations', icon: '📍', tone: 'emerald', permissions: ['manage_pickup_stations', 'edit_company_settings'] },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { to: '/admin/marketplace', label: 'Marketplace', hint: 'Shops, listings & billing', icon: '🏪', tone: 'gold', permissions: ['manage_marketplace', 'edit_company_settings', 'approve_shop_listings', 'view_shop_billing', 'manage_shop_fees'] },
      { to: '/admin/trust', label: 'Trust & reports', hint: 'Shop reports & cautions', icon: '🛡️', tone: 'rose', permissions: ['resolve_shop_reports', 'manage_trust_automation', 'issue_user_caution'] },
    ],
  },
  {
    title: 'Customers & hiring',
    items: [
      { to: '/admin/users', label: 'Customers', hint: 'Accounts', icon: '👤', tone: 'emerald', permission: 'view_users' },
      { to: '/admin/alerts', label: 'Order alerts', hint: 'Needs attention', icon: '🔔', tone: 'gold', permission: 'view_orders', badgeKey: 'alerts' },
      { to: '/admin/contact-inbox', label: 'Inbox', hint: 'Contact messages', icon: '✉️', tone: 'rose', permissions: ['manage_contact_inbox', 'view_company_settings'], badgeKey: 'inbox' },
      { to: '/admin/career-applications', label: 'Hiring', hint: 'Applicants', icon: '📝', tone: 'green', permissions: ['manage_careers', 'hire_employees'], badgeKey: 'careers' },
    ],
  },
  {
    title: 'Insights & settings',
    items: [
      { to: '/admin/reports', label: 'Reports', hint: 'Sales & exports', icon: '📈', tone: 'purple', permission: 'view_reports' },
      { to: '/admin/company-settings', label: 'Company settings', hint: 'Modules & contact', icon: '⚙️', tone: 'neutral', permission: 'view_company_settings' },
      { to: '/admin/launch-readiness', label: 'Launch readiness', hint: 'Pilot checklist', icon: '🚀', tone: 'gold', superAdminOnly: true },
    ],
  },
];

function visibleNavItems(user, isSuperAdmin, badges) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        if (item.superAdminOnly) return isSuperAdmin;
        if (item.permissions?.length) return hasAnyPermission(user, item.permissions);
        if (item.permission) return hasPermission(user, item.permission);
        return true;
      })
      .map((item) => ({
        ...item,
        badge: item.badgeKey ? badges[item.badgeKey] ?? 0 : 0,
      })),
  })).filter((group) => group.items.length > 0);
}

function launchBanner(launchReady) {
  if (!launchReady) return null;
  if (!launchReady.ready) {
    return {
      title: 'P1 pilot — action needed',
      detail: `${launchReady.summary?.fail ?? 0} blocking check(s) · ${launchReady.stats?.products_active ?? 0} active products`,
    };
  }
  if (launchReady.p2 && !launchReady.p2.ready) {
    return {
      title: 'P2 public launch — action needed',
      detail: `${launchReady.p2.summary?.fail ?? 0} blocking item(s) — legal policies, footer, or SEO files`,
    };
  }
  if (!(launchReady.p3?.ready && launchReady.p4?.ready && launchReady.p5?.ready)) {
    if (launchReady.p3 && !launchReady.p3.ready) {
      return {
        title: 'P3 logistics & marketplace — action needed',
        detail: `${launchReady.p3.summary?.fail ?? 0} blocking item(s) — pickup, drivers, or marketplace setup`,
      };
    }
    if (launchReady.p4 && !launchReady.p4.ready && launchReady.p4.hr_enabled) {
      return {
        title: 'P4 workforce HR — action needed',
        detail: `${launchReady.p4.summary?.fail ?? 0} blocking item(s) — employee profiles or leave settings`,
      };
    }
    if (launchReady.p5 && !launchReady.p5.ready) {
      return {
        title: 'P5 quality & ops — action needed',
        detail: `${launchReady.p5.summary?.fail ?? 0} blocking item(s) — smoke tests, analytics, or monitoring`,
      };
    }
    return {
      title: 'Phase 2 — expand operations',
      detail: 'Enable modules one at a time under Launch readiness',
    };
  }
  return null;
}

export default function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const alertsQuery = useAlertCount(true);
  const reportsQuery = useAdminReports();
  const staffQuery = useStaff(isSuperAdmin);
  const { data: inboxUnread = 0 } = useContactInboxCount(true);
  const { data: careersUnread = 0 } = useCareerApplicationsCount(true);
  const { data: launchReady } = useLaunchReadiness(isSuperAdmin);

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

  const navGroups = useMemo(
    () => visibleNavItems(user, isSuperAdmin, badges),
    [user, isSuperAdmin, badges]
  );

  const banner = useMemo(
    () => (isSuperAdmin ? launchBanner(launchReady) : null),
    [isSuperAdmin, launchReady]
  );

  const initialLoading =
    (reportsQuery.isPending && reportData == null)
    || (alertsQuery.isPending && alertData == null);

  const reportsFailed = reportsQuery.isError && reportData == null;

  return (
    <div>
      <AdminPageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle="Overview — stats first, then shortcuts by area."
      />

      {banner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <div>
            <p className="font-bold">{banner.title}</p>
            <p className="mt-1 text-sm text-muted">{banner.detail}</p>
          </div>
          <Link to="/admin/launch-readiness" className="btn-primary shrink-0 text-sm">
            Open checklist
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
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Today</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              {isSuperAdmin ? (
                <AdminStatCard
                  to="/admin/staff"
                  label="Staff accounts"
                  value={staffQuery.isError ? '—' : staffCount}
                  change={staffQuery.isError ? 'Could not load staff' : 'With delegated access'}
                  icon="👥"
                  tone="purple"
                />
              ) : (
                <AdminStatCard
                  to="/admin/company-settings"
                  label="Your role"
                  value="Staff"
                  change="RBAC permissions active"
                  icon="🔐"
                  tone="green"
                />
              )}
            </div>
          </section>

          {navGroups.map((group) => (
            <section key={group.title} className="mb-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{group.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((card) => (
                  <AdminStatCard
                    key={card.to}
                    to={card.to}
                    label={card.label}
                    change={card.hint}
                    icon={card.icon}
                    tone={card.tone}
                    variant="nav"
                    badge={card.badge}
                  />
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Storefront</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AdminStatCard
                to="/"
                label="View customer site"
                change="Open storefront"
                icon="🛒"
                tone="emerald"
                variant="nav"
                external
              />
            </div>
          </section>
        </>
      )}

      {!isAdminUser(user) && null}
    </div>
  );
}
