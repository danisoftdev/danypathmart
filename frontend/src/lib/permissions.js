// Canonical RBAC keys — keep in sync with backend StaffPermission::KEYS.

export const PERMISSION_KEYS = [
  'view_orders',
  'edit_orders',
  'view_quotes',
  'edit_quotes',
  'view_products',
  'add_edit_products',
  'delete_products',
  'manage_categories',
  'manage_size_guides',
  'manage_kits',
  'manage_flash_sale',
  'view_hero_banners',
  'manage_hero_banners',
  'view_legal_policies',
  'manage_legal_policies',
  'view_users',
  'edit_users',
  'send_notifications',
  'manage_staff',
  'hire_employees',
  'manage_position_permissions',
  'view_company_settings',
  'edit_company_settings',
  'manage_shipping',
  'manage_pickup_stations',
  'manage_hub_logistics',
  'manage_delivery_runs',
  'manage_station_staff',
  'manage_marketplace',
  'approve_shop_applications',
  'approve_shop_listings',
  'manage_promoters',
  'view_shop_billing',
  'manage_shop_fees',
  'manage_shop_registration_promo',
  'manage_referral_registration_discount',
  'waive_shop_fees',
  'manage_contact_inbox',
  'manage_careers',
  'view_reports',
  'export_reports',
  'view_image_alerts',
  'manage_image_alerts',
  'manage_image_search',
  'manage_custom_proofs',
  'view_employees',
  'manage_employee_profiles',
  'view_leave_requests',
  'manage_leave_requests',
];

export const PERMISSION_LABELS = {
  view_orders: 'View orders',
  edit_orders: 'Edit orders & update status',
  view_quotes: 'View quotes',
  edit_quotes: 'Approve / reject quotes',
  view_products: 'View products',
  add_edit_products: 'Add & edit products',
  delete_products: 'Delete products',
  manage_categories: 'Manage categories',
  manage_size_guides: 'Manage size guides',
  manage_kits: 'Manage kit templates',
  manage_flash_sale: 'Manage flash sale',
  view_hero_banners: 'View homepage hero banners',
  manage_hero_banners: 'Manage homepage hero banners',
  view_legal_policies: 'View legal policies',
  manage_legal_policies: 'Manage legal policies',
  view_users: 'View customers',
  edit_users: 'Edit customers',
  send_notifications: 'Send broadcast notifications',
  manage_staff: 'Manage staff accounts',
  hire_employees: 'Hire from applications & create logins',
  manage_position_permissions: 'Edit default permissions per position',
  view_company_settings: 'View company settings',
  edit_company_settings: 'Edit company settings',
  manage_shipping: 'Manage shipping settings',
  manage_pickup_stations: 'Manage pickup stations',
  manage_hub_logistics: 'Hub receive & station handoff',
  manage_delivery_runs: 'Delivery runs & drivers',
  manage_station_staff: 'Station staff & repack accounts',
  manage_marketplace: 'Manage marketplace & shops',
  approve_shop_applications: 'Approve new shop applications',
  approve_shop_listings: 'Approve shop product listings',
  manage_promoters: 'Manage promoter accounts',
  view_shop_billing: 'View shop registration & renewal payments',
  manage_shop_fees: 'Set shop registration fee & renewal (month/year)',
  manage_shop_registration_promo: 'Set free registration period & first-registration discount',
  manage_referral_registration_discount: 'Set referral code discount for new shop applicants',
  waive_shop_fees: 'Waive shop fees & grant billing extensions',
  manage_contact_inbox: 'Contact inbox',
  manage_careers: 'Careers, job posts & applications',
  view_reports: 'View reports',
  export_reports: 'Export reports & data',
  view_image_alerts: 'View image alerts',
  manage_image_alerts: 'Manage image alerts',
  manage_image_search: 'Enable image search (Google Vision)',
  manage_custom_proofs: 'Custom proof approvals',
  view_employees: 'View employee profiles',
  manage_employee_profiles: 'Manage employee profiles',
  view_leave_requests: 'View leave requests',
  manage_leave_requests: 'Manage leave requests',
};

export const PERMISSION_GROUPS = [
  { title: 'Orders', keys: ['view_orders', 'edit_orders'] },
  { title: 'Quotes', keys: ['view_quotes', 'edit_quotes'] },
  {
    title: 'Products & catalogue',
    keys: [
      'view_products', 'add_edit_products', 'delete_products',
      'manage_categories', 'manage_size_guides', 'manage_kits', 'manage_flash_sale',
    ],
  },
  {
    title: 'Customers & comms',
    keys: ['view_users', 'edit_users', 'send_notifications', 'manage_contact_inbox'],
  },
  {
    title: 'Staff & hiring',
    keys: [
      'manage_staff', 'hire_employees', 'manage_position_permissions',
      'view_employees', 'manage_employee_profiles',
      'view_leave_requests', 'manage_leave_requests',
    ],
  },
  { title: 'Careers', keys: ['manage_careers'] },
  { title: 'Marketplace', keys: ['manage_marketplace', 'approve_shop_applications', 'approve_shop_listings', 'manage_promoters', 'view_shop_billing', 'manage_shop_fees', 'manage_shop_registration_promo', 'manage_referral_registration_discount', 'waive_shop_fees'] },
  {
    title: 'Storefront content',
    keys: ['view_hero_banners', 'manage_hero_banners', 'view_legal_policies', 'manage_legal_policies'],
  },
  {
    title: 'Company & shipping',
    keys: [
      'view_company_settings', 'edit_company_settings', 'manage_shipping',
      'manage_pickup_stations', 'manage_hub_logistics', 'manage_delivery_runs',
      'manage_station_staff',
    ],
  },
  { title: 'Reports & exports', keys: ['view_reports', 'export_reports'] },
  { title: 'Image search & alerts', keys: ['manage_image_search', 'view_image_alerts', 'manage_image_alerts'] },
  { title: 'Custom proofs', keys: ['manage_custom_proofs'] },
];

export function emptyPermissions(value = false) {
  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {});
}

export function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return !!user.permissions?.[key];
}

export function hasAnyPermission(user, keys) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return keys.some((k) => !!user.permissions?.[k]);
}

function isAdminUser(user) {
  return !!user && (user.role === 'super_admin' || user.role === 'staff');
}

function isDriverUser(user) {
  return !!user && user.role === 'driver';
}

function isStationStaffUser(user) {
  return !!user && user.role === 'station_staff';
}

function isPromoterUser(user) {
  return !!user && user.role === 'promoter';
}

function homePathForUser(user) {
  if (isPromoterUser(user)) return '/promoter';
  if (isStationStaffUser(user)) return '/station';
  if (isDriverUser(user)) return '/driver';
  return isAdminUser(user) ? '/admin' : '/dashboard';
}

function accountPathForUser(user) {
  if (!user) return '/login';
  if (isPromoterUser(user)) return '/promoter';
  if (isStationStaffUser(user)) return '/station';
  if (isDriverUser(user)) return '/driver';
  return isAdminUser(user) ? '/admin/dashboard' : '/dashboard';
}

export {
  isAdminUser,
  isDriverUser,
  isStationStaffUser,
  homePathForUser,
  accountPathForUser,
};
