import { Link, NavLink } from 'react-router-dom';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';

/**
 * Mobile-only shortcuts (desktop uses the sidebar).
 * Keep this short — no duplicates of every sidebar link.
 */
export const ADMIN_QUICK_ACTIONS = [
  { to: '/admin/dashboard', label: 'Home', end: true },
  { to: '/admin/orders', label: 'Orders', permission: 'view_orders' },
  { to: '/admin/alerts', label: 'Alerts', permission: 'view_orders', badgeKey: 'alerts' },
  { to: '/admin/products', label: 'Products', permission: 'view_products' },
  { to: '/admin/marketplace', label: 'Shops', permissions: ['manage_marketplace', 'edit_company_settings', 'approve_shop_listings', 'view_shop_billing'] },
  { to: '/admin/contact-inbox', label: 'Inbox', permissions: ['manage_contact_inbox', 'view_company_settings'], badgeKey: 'inbox' },
  { to: '/admin/support-chat', label: 'Chat', permissions: ['manage_contact_inbox', 'view_company_settings'], badgeKey: 'supportChat' },
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
