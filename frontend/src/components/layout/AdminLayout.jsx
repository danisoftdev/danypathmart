import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAlertCount, useCareerApplicationsCount, useContactInboxCount } from '../../hooks/admin';
import { useAdminSupportChatCount } from '../../hooks/supportChat';
import { useNotificationCount } from '../../hooks/notifications';
import { hasAnyPermission, hasPermission, isAdminUser } from '../../lib/permissions';
import SiteLogo from '../brand/SiteLogo';
import UserAvatar from '../brand/UserAvatar';
import { AdminPageLoading } from '../admin/AdminFetchState';
import AdminQuickBar from '../admin/AdminQuickBar';

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/admin/launch-readiness', label: 'Launch readiness', superAdminOnly: true, icon: '🚀' },
      { to: '/admin/reports', label: 'Reports', permission: 'view_reports', icon: '📈' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders & sales',
    items: [
      { to: '/admin/orders', label: 'Orders', permission: 'view_orders', icon: '📦' },
      { to: '/admin/alerts', label: 'Order alerts', permission: 'view_orders', icon: '🔔', badge: 'notify' },
      { to: '/admin/quotes', label: 'Quotes', permissions: ['view_quotes', 'view_orders'], icon: '📋' },
      { to: '/admin/custom-proofs', label: 'Custom proofs', permission: 'view_orders', icon: '🎨' },
      { to: '/admin/image-alerts', label: 'Image alerts', permission: 'view_image_alerts', icon: '🖼️', badge: 'alerts' },
    ],
  },
  {
    id: 'pos',
    label: 'POS',
    items: [
      { to: '/pos', label: 'Register', permission: 'use_pos', icon: '🧾' },
      { to: '/admin/pos', label: 'Setup', permissions: ['manage_pos_config', 'edit_company_settings'], icon: '🖥️' },
      { to: '/admin/pos/labels', label: 'Labels', permissions: ['manage_pos_config', 'edit_company_settings'], icon: '🏷️' },
      { to: '/admin/pos/shifts', label: 'Shifts', permission: 'manage_pos_shifts', icon: '💰' },
      { to: '/admin/pos/reports', label: 'Reports', permission: 'view_pos_reports', icon: '📊' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', permission: 'view_products', icon: '🏷️' },
      { to: '/admin/categories', label: 'Categories', permission: 'manage_categories', icon: '📁' },
      { to: '/admin/size-guides', label: 'Size guides', permission: 'add_edit_products', icon: '📏' },
      { to: '/admin/kits', label: 'Kit templates', permission: 'add_edit_products', icon: '🎒' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers & support',
    items: [
      { to: '/admin/users', label: 'Customers', permission: 'view_users', icon: '👤' },
      { to: '/admin/notifications', label: 'Broadcasts', permission: 'view_users', icon: '📣' },
      { to: '/admin/contact-inbox', label: 'Inbox', permissions: ['manage_contact_inbox', 'view_company_settings'], icon: '✉️', badge: 'inbox' },
      { to: '/admin/support-chat', label: 'Live chat', permissions: ['manage_contact_inbox', 'view_company_settings'], icon: '💬', badge: 'supportChat' },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics',
    items: [
      { to: '/admin/shipping', label: 'Shipping', permission: 'manage_shipping', icon: '🚚' },
      { to: '/admin/pickup-stations', label: 'Pickup stations', permissions: ['manage_pickup_stations', 'edit_company_settings'], icon: '📍' },
      { to: '/admin/hub-logistics', label: 'Hub logistics', permissions: ['manage_hub_logistics', 'edit_company_settings'], icon: '🏭' },
      { to: '/admin/delivery-runs', label: 'Delivery runs', permissions: ['manage_delivery_runs', 'edit_company_settings'], icon: '🚐' },
      { to: '/admin/station-staff', label: 'Station staff', permissions: ['manage_station_staff', 'edit_company_settings'], icon: '📦' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    items: [
      { to: '/admin/marketplace', label: 'Shops & billing', permissions: ['manage_marketplace', 'edit_company_settings', 'approve_shop_listings', 'view_shop_billing', 'manage_shop_fees', 'manage_shop_registration_promo', 'manage_referral_registration_discount', 'waive_shop_fees'], icon: '🏪' },
      { to: '/admin/trust', label: 'Trust & reports', permissions: ['resolve_shop_reports', 'manage_trust_automation', 'issue_user_caution'], icon: '🛡️' },
    ],
  },
  {
    id: 'storefront',
    label: 'Storefront',
    items: [
      { to: '/admin/hero-banners', label: 'Hero banners', permissions: ['view_hero_banners', 'manage_hero_banners'], icon: '🖼️' },
      { to: '/admin/legal-policies', label: 'Legal policies', permissions: ['view_legal_policies', 'manage_legal_policies'], icon: '📜' },
      { to: '/admin/about-page', label: 'About Us', permissions: ['view_about_page', 'manage_about_page'], icon: 'ℹ️' },
    ],
  },
  {
    id: 'people',
    label: 'People & HR',
    items: [
      { to: '/admin/staff', label: 'Staff accounts', permissions: ['manage_staff'], icon: '👥' },
      { to: '/admin/employees', label: 'Employees', permissions: ['view_employees', 'manage_employee_profiles', 'manage_staff'], icon: '🪪' },
      { to: '/admin/leave-requests', label: 'Leave requests', permissions: ['view_leave_requests', 'manage_leave_requests'], icon: '🏖️' },
      { to: '/admin/job-posts', label: 'Job posts', permissions: ['manage_careers', 'view_company_settings'], icon: '💼' },
      { to: '/admin/career-applications', label: 'Job applications', permissions: ['manage_careers', 'view_company_settings', 'hire_employees'], icon: '📝', badge: 'careers' },
      { to: '/admin/position-permissions', label: 'Position access', permissions: ['manage_staff', 'manage_position_permissions'], icon: '🔐' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { to: '/admin/company-settings', label: 'Company', permission: 'view_company_settings', icon: '🏢' },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** @deprecated Use NAV_GROUPS — kept for any legacy imports */
export const NAV = ALL_NAV_ITEMS;

function navItemVisible(item, user, isSuperAdmin) {
  if (item.superAdminOnly) return isSuperAdmin;
  if (item.permissions?.length) return hasAnyPermission(user, item.permissions);
  if (item.permission) return hasPermission(user, item.permission);
  return true;
}

function resolveBadge(item, { pending, inboxUnread, supportChatUnread, careersUnread, notifyUnread }) {
  if (item.badge === 'alerts') return pending;
  if (item.badge === 'inbox') return inboxUnread;
  if (item.badge === 'supportChat') return supportChatUnread;
  if (item.badge === 'careers') return careersUnread;
  if (item.badge === 'notify') return notifyUnread;
  return 0;
}

/** Lands /admin on the dashboard. */
export function AdminIndexRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!isAdminUser(user)) return <Navigate to="/" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

function SidebarLink({ to, label, icon, badge, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === '/admin/dashboard'}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'admin-nav-link',
          isActive ? 'admin-nav-link-active' : '',
        ].join(' ')
      }
    >
      <span className="text-base" aria-hidden>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-gold px-1.5 text-[10px] font-bold text-black">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function AdminNavGroups({ groups, badges, activeGroupId, onNavigate }) {
  return (
    <>
      {groups.map((group) => (
        <SidebarNavGroup
          key={group.id}
          group={group}
          badges={badges}
          isActiveGroup={group.id === activeGroupId}
          defaultOpen={group.id === activeGroupId || group.id === 'overview'}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

const NAV_GROUPS_STORAGE_KEY = 'dpm_admin_nav_groups_v1';

function readNavGroupOpen(groupId, fallback) {
  try {
    const raw = localStorage.getItem(NAV_GROUPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed[groupId] === 'boolean') return parsed[groupId];
    }
  } catch {
    // ignore
  }
  return fallback;
}

function persistNavGroupOpen(groupId, open) {
  try {
    const raw = localStorage.getItem(NAV_GROUPS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[groupId] = open;
    localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function SidebarNavGroup({ group, badges, isActiveGroup, defaultOpen, onNavigate }) {
  const [open, setOpen] = useState(() => readNavGroupOpen(group.id, defaultOpen));

  useEffect(() => {
    if (isActiveGroup) {
      setOpen(true);
      persistNavGroupOpen(group.id, true);
    }
  }, [isActiveGroup, group.id]);

  useEffect(() => {
    setOpen((prev) => {
      const next = readNavGroupOpen(group.id, defaultOpen);
      return prev === next ? prev : next;
    });
  }, [defaultOpen, group.id]);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      persistNavGroupOpen(group.id, next);
      return next;
    });
  };

  const groupBadge = group.items.reduce((sum, item) => sum + resolveBadge(item, badges), 0);

  return (
    <section className="admin-nav-group">
      <button
        type="button"
        className="admin-nav-group-bar"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <span className="admin-nav-group-label">{group.label}</span>
        <span className="flex items-center gap-1.5">
          {groupBadge > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-gold px-1.5 text-[10px] font-bold text-black">
              {groupBadge > 99 ? '99+' : groupBadge}
            </span>
          )}
          <span className={`admin-nav-group-chevron ${open ? 'admin-nav-group-chevron-open' : ''}`} aria-hidden>
            ›
          </span>
        </span>
      </button>
      {open && (
        <div className="admin-nav-group-links">
          {group.items.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              badge={resolveBadge(item, badges)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  const isSuperAdmin = user?.role === 'super_admin';

  const { data } = useAlertCount(!!user && isAdminUser(user));
  const pending = data?.pending_count ?? 0;
  const { data: inboxUnread = 0 } = useContactInboxCount(
    !!user && isAdminUser(user) && hasAnyPermission(user, ['manage_contact_inbox', 'view_company_settings'])
  );
  const { data: supportChatUnread = 0 } = useAdminSupportChatCount(
    !!user && isAdminUser(user) && hasAnyPermission(user, ['manage_contact_inbox', 'view_company_settings'])
  );
  const { data: careersUnread = 0 } = useCareerApplicationsCount(
    !!user && isAdminUser(user) && hasAnyPermission(user, ['manage_careers', 'view_company_settings', 'hire_employees'])
  );
  const { data: notifyUnread = 0 } = useNotificationCount();

  const badgeCounts = {
    pending,
    inboxUnread,
    supportChatUnread,
    careersUnread,
    notifyUnread,
  };

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => navItemVisible(item, user, isSuperAdmin)),
      })).filter((group) => group.items.length > 0),
    [user, isSuperAdmin]
  );

  const activeGroupId = useMemo(() => {
    const match = visibleGroups.find((group) =>
      group.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      )
    );
    return match?.id ?? visibleGroups[0]?.id ?? null;
  }, [location.pathname, visibleGroups]);

  const currentLabel =
    ALL_NAV_ITEMS.find((n) => location.pathname === n.to || location.pathname.startsWith(`${n.to}/`))?.label
    || 'Admin';

  const isDashboard = location.pathname === '/admin/dashboard';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  // Wait for /auth/me — avoid redirecting to home while user is still loading.
  if (isAuthenticated && !user) {
    return (
      <div className="admin-shell">
        <div className="admin-content">
          <AdminPageLoading />
        </div>
      </div>
    );
  }

  if (!isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar hidden lg:flex">
        <div className="admin-sidebar-brand">
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            <SiteLogo to={null} size="h-11 w-11" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">DanyPathMart</p>
              <p className="text-lg font-extrabold text-white">Seller Center</p>
            </div>
          </Link>
          {isSuperAdmin && (
            <span className="mt-2 inline-block rounded-md bg-brand-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-gold">
              Super Admin
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-3">
          <AdminNavGroups
            groups={visibleGroups}
            badges={badgeCounts}
            activeGroupId={activeGroupId}
          />
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
            <UserAvatar user={user} className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{user?.name}</p>
              {user?.staff_id && (
                <p className="truncate font-mono text-[10px] font-bold text-brand-gold">{user.staff_id}</p>
              )}
              <p className="truncate text-xs text-white/50">{user?.email}</p>
            </div>
          </div>
          <Link to="/" className="admin-sidebar-back">
            ← Back to store
          </Link>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-row border-b border-black/5 dark:border-white/10">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className="admin-mobile-menu-btn lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open admin menu"
              >
                ☰
              </button>
              <Link to="/admin/dashboard" className="text-xs font-extrabold text-brand-green lg:hidden">
                DPM Admin
              </Link>
              <span className="hidden text-xs text-muted lg:inline">Seller Center</span>
              <span className="hidden text-xs text-muted lg:inline">/</span>
              <span className="truncate text-xs font-semibold">{currentLabel}</span>
            </div>
          </div>
          {/* Quick bar is mobile-only — desktop already has the sidebar. */}
          {!isDashboard && (
            <div className="admin-topbar-row lg:hidden">
              <AdminQuickBar
                user={user}
                badges={{
                  alerts: pending,
                  inbox: inboxUnread,
                  supportChat: supportChatUnread,
                  careers: careersUnread,
                }}
              />
            </div>
          )}
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      {mobileNavOpen && (
        <div className="admin-mobile-drawer-root lg:hidden">
          <button
            type="button"
            className="admin-mobile-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="admin-mobile-drawer">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-extrabold text-white">Menu</p>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-lg text-white/70 hover:bg-white/10"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>
            <nav className="flex-1 space-y-2 overflow-y-auto p-3">
              <AdminNavGroups
                groups={visibleGroups}
                badges={badgeCounts}
                activeGroupId={activeGroupId}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </nav>
            <div className="border-t border-white/10 p-3">
              <Link to="/" className="admin-sidebar-back" onClick={() => setMobileNavOpen(false)}>
                ← Back to store
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
