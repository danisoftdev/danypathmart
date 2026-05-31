import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { resolveImageUrl } from '../../lib/currency';
import { MenuIcon, CloseIcon, UserIcon } from '../icons';

const NAV = [
  { to: '/dashboard', end: true, label: 'My Orders', icon: BoxIcon },
  { to: '/dashboard/settings', end: false, label: 'Settings', icon: GearIcon },
];

function BoxIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}

function GearIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}

function LogoutIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export default function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-black/5 px-5 py-5 dark:border-white/10">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-green/10 text-brand-green">
          {user?.profile_photo ? (
            <img src={resolveImageUrl(user.profile_photo)} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user?.name || 'My account'}</p>
          <p className="truncate text-xs text-black/50 dark:text-white/50">{user?.email}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-green text-white'
                  : 'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-black/5 px-3 py-4 dark:border-white/10">
        <button
          type="button"
          onClick={doLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-red transition hover:bg-brand-red/10"
        >
          <LogoutIcon className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {/* Mobile top bar */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <h1 className="text-lg font-bold">My account</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-black/10 p-2 dark:border-white/15"
          aria-label="Open menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden rounded-2xl border border-black/5 bg-white shadow-sm lg:block dark:border-white/10 dark:bg-[#161616]">
          {SidebarContent}
        </aside>

        {/* Mobile slide-over */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl dark:bg-[#161616]">
              <div className="flex justify-end p-3">
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              {SidebarContent}
            </div>
          </div>
        )}

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </section>
  );
}
