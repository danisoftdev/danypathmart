import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useStationDashboard } from '../../hooks/station';
import { useAuthStore } from '../../store/authStore';
import { isStationStaffUser } from '../../lib/permissions';
import UserAvatar from '../brand/UserAvatar';
import { formatStationAddress } from '../../lib/orderStatus';

const TABS = [
  { to: '/station', end: true, label: 'Repack inbound', queue: 'inbound' },
  { to: '/station/ready', end: true, label: 'Release to customer', queue: 'ready' },
];

export default function StationLayout() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error } = useStationDashboard(!!user && isStationStaffUser(user));

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/station' }} />;
  }

  if (!isStationStaffUser(user)) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-muted">
        Loading station portal…
      </div>
    );
  }

  if (isError) {
    const msg = error?.response?.data?.message || 'Could not load station portal.';
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Station portal</h1>
        <p className="mt-3 text-sm text-muted">{msg}</p>
        <Link to="/" className="mt-4 block text-sm font-bold text-brand-green hover:underline">
          Back to store
        </Link>
      </div>
    );
  }

  const station = data?.station;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 pb-24 md:py-8">
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E]">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gold/20 text-2xl" aria-hidden>
          📦
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Station repack</p>
          <p className="truncate font-bold">{station?.name || 'Pickup station'}</p>
          {station && (
            <p className="truncate text-xs text-muted">{formatStationAddress(station)}</p>
          )}
        </div>
        <UserAvatar user={user} className="h-12 w-12 shrink-0" />
      </div>

      <nav className="portal-quick-bar" aria-label="Station shortcuts">
        {TABS.map(({ to, end, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'admin-quick-btn-active' : 'admin-quick-btn')}
          >
            {label}
            {to === '/station' && (data?.inbound_count ?? 0) > 0 && (
              <span className="admin-quick-btn-count">{data.inbound_count}</span>
            )}
            {to === '/station/ready' && (data?.ready_count ?? 0) > 0 && (
              <span className="admin-quick-btn-count">{data.ready_count}</span>
            )}
          </NavLink>
        ))}
        <Link to="/" className="admin-quick-btn admin-quick-btn-muted">
          Store
        </Link>
      </nav>

      <Outlet context={{ station }} />

      <p className="mt-8 text-center text-xs text-muted">
        <Link to="/" className="font-bold text-brand-green hover:underline">
          Back to store
        </Link>
      </p>
    </section>
  );
}
