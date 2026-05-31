import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAlertCount } from '../../hooks/admin';

const ADMIN_ROLES = ['super_admin', 'staff'];

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
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const { data } = useAlertCount(isAdmin);
  const pending = data?.pending_count ?? 0;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="md:w-60 md:flex-shrink-0">
        <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1c]">
          <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
            Admin
          </p>
          <nav className="space-y-1">
            <SidebarLink to="/admin/image-alerts" label="Image Alerts" badge={pending} />
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
