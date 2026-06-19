import { Link, NavLink } from 'react-router-dom';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';

/** Compact top-bar shortcuts — permission-filtered. */
export const ADMIN_QUICK_ACTIONS = [
  { to: '/admin/dashboard', label: 'Home', end: true },
  { to: '/admin/orders', label: 'Orders', permission: 'view_orders' },
  { to: '/admin/alerts', label: 'Alerts', permission: 'view_orders', badgeKey: 'alerts' },
  { to: '/admin/products', label: 'Products', permission: 'view_products' },
  { to: '/admin/image-alerts', label: 'Images', permission: 'view_image_alerts' },
  { to: '/admin/quotes', label: 'Quotes', permissions: ['view_quotes', 'view_orders'] },
  { to: '/admin/hub-logistics', label: 'Hub', permissions: ['manage_hub_logistics', 'edit_company_settings'] },
  { to: '/admin/delivery-runs', label: 'Runs', permissions: ['manage_delivery_runs', 'edit_company_settings'] },
  { to: '/admin/pickup-stations', label: 'Stations', permissions: ['manage_pickup_stations', 'edit_company_settings'] },
  { to: '/admin/station-staff', label: 'Staff', permissions: ['manage_station_staff', 'edit_company_settings'] },
  { to: '/admin/marketplace', label: 'Shops', permissions: ['manage_marketplace', 'edit_company_settings', 'approve_shop_listings'] },
  { to: '/admin/users', label: 'Customers', permission: 'view_users' },
  { to: '/admin/reports', label: 'Reports', permission: 'view_reports' },
  { to: '/admin/shipping', label: 'Shipping', permission: 'manage_shipping' },
  { to: '/admin/contact-inbox', label: 'Inbox', permissions: ['manage_contact_inbox', 'view_company_settings'], badgeKey: 'inbox' },
  { to: '/admin/support-chat', label: 'Chat', permissions: ['manage_contact_inbox', 'view_company_settings'], badgeKey: 'supportChat' },
  { to: '/admin/career-applications', label: 'Hiring', permissions: ['manage_careers', 'hire_employees'], badgeKey: 'careers' },
  { to: '/admin/staff', label: 'Team', permissions: ['manage_staff'] },
  { to: '/admin/company-settings', label: 'Settings', permission: 'view_company_settings' },
];

function visibleForUser(user, item) {
  if (item.permissions?.length) return hasAnyPermission(user, item.permissions);
  if (item.permission) return hasPermission(user, item.permission);
  return true;
}

export default function AdminQuickBar({ user, badges = {}, className = '' }) {
  if (!user) return null;

  const items = ADMIN_QUICK_ACTIONS.filter((item) => visibleForUser(user, item));

  return (
    <nav
      className={`admin-quick-bar scrollbar-hide ${className}`.trim()}
      aria-label="Quick navigation"
    >
      {items.map((item) => {
        const count = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              ['admin-quick-btn', isActive ? 'admin-quick-btn-active' : '', count > 0 ? 'admin-quick-btn-badge' : '']
                .filter(Boolean)
                .join(' ')
            }
          >
            <span>{item.label}</span>
            {count > 0 && (
              <span className="admin-quick-btn-count">{count > 99 ? '99+' : count}</span>
            )}
          </NavLink>
        );
      })}
      <Link to="/" className="admin-quick-btn admin-quick-btn-muted">
        Store
      </Link>
    </nav>
  );
}
