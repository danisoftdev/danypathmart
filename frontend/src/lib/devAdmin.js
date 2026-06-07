/** True when local dev may skip admin login / 2FA (never in production builds). */
export function isDevAdminBypassEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN_BYPASS === 'true';
}
