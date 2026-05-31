// Canonical RBAC permission keys (must mirror the backend StaffPermission::KEYS).
export const PERMISSION_KEYS = [
  'view_orders',
  'edit_orders',
  'view_products',
  'add_edit_products',
  'delete_products',
  'manage_categories',
  'view_users',
  'edit_users',
  'manage_staff',
  'view_company_settings',
  'edit_company_settings',
  'manage_shipping',
  'view_reports',
  'view_image_alerts',
  'manage_image_alerts',
];

export const PERMISSION_LABELS = {
  view_orders: 'View orders',
  edit_orders: 'Edit orders & update status',
  view_products: 'View products',
  add_edit_products: 'Add & edit products',
  delete_products: 'Delete products',
  manage_categories: 'Manage categories',
  view_users: 'View customers',
  edit_users: 'Edit customers',
  manage_staff: 'Manage staff accounts',
  view_company_settings: 'View company settings',
  edit_company_settings: 'Edit company settings',
  manage_shipping: 'Manage shipping settings',
  view_reports: 'View reports',
  view_image_alerts: 'View image alerts',
  manage_image_alerts: 'Manage image alerts',
};

// Grouped sections for the permission grid.
export const PERMISSION_GROUPS = [
  { title: 'Orders', keys: ['view_orders', 'edit_orders'] },
  { title: 'Products', keys: ['view_products', 'add_edit_products', 'delete_products', 'manage_categories'] },
  { title: 'Users', keys: ['view_users', 'edit_users', 'manage_staff'] },
  { title: 'Settings', keys: ['view_company_settings', 'edit_company_settings', 'manage_shipping'] },
  { title: 'Reports', keys: ['view_reports'] },
  { title: 'Image Alerts', keys: ['view_image_alerts', 'manage_image_alerts'] },
];

export function emptyPermissions(value = false) {
  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {});
}

/** True if the user holds the permission (super_admin bypasses all checks). */
export function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return !!user.permissions?.[key];
}

export function isAdminUser(user) {
  return !!user && (user.role === 'super_admin' || user.role === 'staff');
}

/** Where a user should land after authenticating. Admins go to the admin panel. */
export function homePathForUser(user) {
  return isAdminUser(user) ? '/admin' : '/dashboard';
}
