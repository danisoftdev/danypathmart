import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { isDriverUser } from '../../lib/permissions';
import UserAvatar from '../brand/UserAvatar';

export default function DriverLayout() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/driver' }} />;
  }

  if (!isDriverUser(user)) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 pb-24 md:py-8">
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E]">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-green/10 text-2xl" aria-hidden>
          🚐
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Driver portal</p>
          <p className="truncate font-bold">{user.name}</p>
          <p className="text-xs text-muted">Hub → pickup station deliveries</p>
        </div>
        <UserAvatar user={user} className="h-12 w-12 shrink-0" />
      </div>

      <nav className="portal-quick-bar" aria-label="Driver shortcuts">
        <NavLink to="/driver" end className={({ isActive }) => (isActive ? 'admin-quick-btn-active' : 'admin-quick-btn')}>
          Active runs
        </NavLink>
        <Link to="/" className="admin-quick-btn admin-quick-btn-muted">
          Store
        </Link>
      </nav>

      <Outlet />

      <p className="mt-8 text-center text-xs text-muted">
        <Link to="/" className="font-bold text-brand-green hover:underline">
          Back to store
        </Link>
      </p>
    </section>
  );
}
