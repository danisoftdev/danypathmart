import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAlertCount } from '../../hooks/admin';
import { hasPermission, isAdminUser } from '../../lib/permissions';

// Sidebar items gated by RBAC permission. super_admin bypasses all checks (hasPermission).
const NAV = [
  { to: '/admin/orders', label: 'Orders', permission: 'view_orders' },
  { to: '/admin/products', label: 'Products', permission: 'view_products' },
  { to: '/admin/categories', label: 'Categories', permission: 'manage_categories' },
  { to: '/admin/users', label: 'Customers', permission: 'view_users' },
  { to: '/admin/reports', label: 'Reports', permission: 'view_reports' },
  { to: '/admin/shipping', label: 'Shipping & Rates', permission: 'manage_shipping' },
  { to: '/admin/company-settings', label: 'Company Settings', permission: 'view_company_settings' },
  { to: '/admin/image-alerts', label: 'Image Alerts', permission: 'view_image_alerts', badge: 'alerts' },
  { to: '/admin/staff', label: 'Staff Accounts', superAdminOnly: true },
];

/** Lands /admin on the first section the user can actually access. */
export function AdminIndexRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!isAdminUser(user)) return <Navigate to="/" replace />;

  for (const item of NAV) {
    if (item.superAdminOnly && user?.role !== 'super_admin') continue;
    if (item.permission && !hasPermission(user, item.permission)) continue;
    return <Navigate to={item.to} replace />;
  }

  return <Navigate to="/" replace />;
}

function SidebarLink({ to, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-brand-green text-white'
            : 'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10',
        ].join(' ')
      }
    >
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminUser(user);
  const isSuperAdmin = user?.role === 'super_admin';

  const { data } = useAlertCount(isAdmin);
  const pending = data?.pending_count ?? 0;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const visible = NAV.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.permission) return hasPermission(user, item.permission);
    return true;
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="md:w-60 md:flex-shrink-0">
        <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1c]">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              Admin
            </span>
            {isSuperAdmin && (
              <span className="rounded-full bg-brand-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Super Admin
              </span>
            )}
          </div>
          <nav className="space-y-1">
            {visible.map((item) => (
              <SidebarLink
                key={item.to}
                to={item.to}
                label={item.label}
                badge={item.badge === 'alerts' ? pending : 0}
              />
            ))}
          </nav>
          <Link
            to="/"
            className="mt-4 block px-3 text-xs text-black/50 hover:text-brand-green dark:text-white/50"
          >
            &larr; Back to store
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
