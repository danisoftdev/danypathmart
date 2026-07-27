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
  'delete_accounts',
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
  'create_shop_manual',
  'create_shop_preapproved',
  'invite_shop_owner',
  'view_shop_policy_acceptances',
  'view_shops_map',
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
  'manage_product_reviews',
  'manage_support_bot',
  'manage_messaging_integrations',
  'use_pos',
  'manage_pos_shifts',
  'manage_pos_config',
  'view_pos_reports',
  'issue_user_caution',
  'restrict_users',
  'resolve_shop_reports',
  'manage_trust_automation',
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
  manage_legal_policies: 'Update all legal policies (text + downloads)',
  view_users: 'View customers',
  edit_users: 'Edit customers',
  delete_accounts: 'Delete customer, promoter, driver, station staff & related accounts',
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
  create_shop_manual: 'Create shop for someone (direct)',
  create_shop_preapproved: 'Create pre-approved shop application',
  invite_shop_owner: 'Invite someone to register a shop',
  view_shop_policy_acceptances: 'View saved shop policy acceptances',
  view_shops_map: 'View shops on admin map with markers',
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
  manage_product_reviews: 'Moderate product reviews',
  manage_support_bot: 'Manage live chat bot scripts',
  manage_messaging_integrations: 'Toggle SMS, WhatsApp API & push settings',
  use_pos: 'Use POS register & complete sales',
  manage_pos_shifts: 'Approve shifts, void sales & supervisor actions',
  manage_pos_config: 'Manage POS locations, registers & settings',
  view_pos_reports: 'View POS sales reports',
  issue_user_caution: 'Issue cautions & notices to users',
  restrict_users: 'Restrict or suspend user accounts',
  resolve_shop_reports: 'Review & resolve shop reports',
  manage_trust_automation: 'Configure trust automation rules',
};

export const PERMISSION_GROUPS = [
  { title: 'Orders', keys: ['view_orders', 'edit_orders', 'use_pos', 'manage_pos_shifts', 'view_pos_reports'] },
  { title: 'Quotes', keys: ['view_quotes', 'edit_quotes'] },
  {
    title: 'Products & catalogue',
    keys: [
      'view_products', 'add_edit_products', 'delete_products',
      'manage_categories', 'manage_size_guides', 'manage_kits', 'manage_flash_sale', 'manage_product_reviews',
    ],
  },
  {
    title: 'Customers & comms',
    keys: ['view_users', 'edit_users', 'delete_accounts', 'send_notifications', 'manage_contact_inbox', 'manage_support_bot', 'manage_messaging_integrations', 'issue_user_caution', 'restrict_users', 'resolve_shop_reports', 'manage_trust_automation'],
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
  { title: 'Marketplace', keys: ['manage_marketplace', 'approve_shop_applications', 'approve_shop_listings', 'create_shop_manual', 'create_shop_preapproved', 'invite_shop_owner', 'view_shop_policy_acceptances', 'view_shops_map', 'manage_promoters', 'view_shop_billing', 'manage_shop_fees', 'manage_shop_registration_promo', 'manage_referral_registration_discount', 'waive_shop_fees'] },
  {
    title: 'Storefront content',
    keys: ['view_hero_banners', 'manage_hero_banners', 'view_legal_policies', 'manage_legal_policies'],
  },
  {
    title: 'Company & shipping',
    keys: [
      'view_company_settings', 'edit_company_settings', 'manage_shipping',
      'manage_pickup_stations', 'manage_hub_logistics', 'manage_delivery_runs',
      'manage_station_staff', 'manage_pos_config',
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

/** Staff who handle live chat / contact inbox — they get the staff inbox UI, not buyer chat. */
export function canManageSupportChat(user) {
  return hasAnyPermission(user, ['manage_contact_inbox', 'view_company_settings', 'manage_support_bot']);
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

function isShopOwnerUser(user) {
  return !!user && (!!user.has_shop || (user.shop_id != null && Number(user.shop_id) > 0));
}

function homePathForUser(user) {
  if (isPromoterUser(user)) return '/promoter';
  if (isStationStaffUser(user)) return '/station';
  if (isDriverUser(user)) return '/driver';
  if (isAdminUser(user)) return '/admin';
  if (isShopOwnerUser(user)) return '/seller';
  return '/dashboard';
}

function accountPathForUser(user) {
  if (!user) return '/login';
  if (isPromoterUser(user)) return '/promoter';
  if (isStationStaffUser(user)) return '/station';
  if (isDriverUser(user)) return '/driver';
  if (isAdminUser(user)) return '/admin/dashboard';
  if (isShopOwnerUser(user)) return '/seller';
  return '/dashboard';
}

export {
  isAdminUser,
  isDriverUser,
  isStationStaffUser,
  isShopOwnerUser,
  homePathForUser,
  accountPathForUser,
};
