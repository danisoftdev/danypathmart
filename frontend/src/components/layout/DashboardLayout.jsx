import { Link, NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { isAdminUser, isDriverUser, isShopOwnerUser, isStationStaffUser } from '../../lib/permissions';
import UserAvatar from '../brand/UserAvatar';

const NAV = [
  { to: '/dashboard', end: true, label: 'Overview', icon: '🏠' },
  { to: '/dashboard/orders', end: false, label: 'Orders', icon: '📦' },
  { to: '/dashboard/quotes', end: false, label: 'Quotes', icon: '📋' },
  { to: '/dashboard/wishlist', end: false, label: 'Wishlist', icon: '♥' },
  { to: '/dashboard/wallet', end: false, label: 'Wallet', icon: '💰' },
  { to: '/dashboard/notifications', end: false, label: 'Notifications', icon: '🔔' },
  { to: '/dashboard/addresses', end: false, label: 'Addresses', icon: '📍' },
  { to: '/dashboard/security', end: false, label: 'Security', icon: '🔒' },
  { to: '/dashboard/settings', end: false, label: 'Settings', icon: '⚙️' },
];

/** Paths shop owners may still open (purchases + account security). */
const SHOP_OWNER_DASHBOARD_ALLOW = [
  '/dashboard/orders',
  '/dashboard/quotes',
  '/dashboard/wishlist',
  '/dashboard/wallet',
  '/dashboard/notifications',
  '/dashboard/addresses',
  '/dashboard/security',
  '/dashboard/settings',
];

export default function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isStationStaffUser(user)) {
    return <Navigate to="/station" replace />;
  }

  if (isDriverUser(user)) {
    return <Navigate to="/driver" replace />;
  }

  if (isAdminUser(user)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (isShopOwnerUser(user)) {
    const allowed = SHOP_OWNER_DASHBOARD_ALLOW.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
    );
    if (!allowed) {
      return <Navigate to="/seller" replace />;
    }
  }
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 pb-24 md:py-8">
      {/* Mobile account header */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] lg:hidden">
        <UserAvatar user={user} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{user?.name || 'My account'}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <Link to="/shop" className="shrink-0 rounded-xl bg-brand-green px-3 py-2 text-xs font-bold text-white">
          Shop
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-[#1E1E1E]">
            <div className="border-b border-black/5 bg-brand-green/5 px-4 py-5 dark:border-white/10">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Account center</p>
              <p className="mt-1 truncate text-sm font-bold">{user?.name}</p>
            </div>
            <nav className="space-y-0.5 p-2">
              {NAV.map(({ to, end, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    [
                      'flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                      isActive
                        ? 'bg-brand-green text-white shadow-sm'
                        : 'text-[#111111]/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5',
                    ].join(' ')
                  }
                >
                  <span aria-hidden>{icon}</span>
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-black/5 p-2 dark:border-white/10">
              <button
                type="button"
                onClick={doLogout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-red transition hover:bg-brand-red/10"
              >
                <span aria-hidden>🚪</span>
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile horizontal nav */}
        <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden" aria-label="Account sections">
          {NAV.map(({ to, end, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'shrink-0 rounded-full px-4 py-2 text-sm font-bold transition',
                  isActive ? 'bg-brand-green text-white' : 'bg-white text-[#111111]/70 dark:bg-[#1E1E1E] dark:text-white/70',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 lg:col-start-2">
          <Outlet />
        </main>
      </div>
    </section>
  );
}
