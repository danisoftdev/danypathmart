import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function PosLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1419] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/pos" className="text-lg font-extrabold text-brand-green">
            DPM POS
          </Link>
          <nav className="hidden gap-3 text-sm sm:flex">
            <Link to="/pos" className="text-white/80 hover:text-white">Register</Link>
            <Link to="/admin/pos/shifts" className="text-white/80 hover:text-white">Shifts</Link>
            <Link to="/admin/pos" className="text-white/80 hover:text-white">Setup</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-white/60 sm:inline">{user?.name}</span>
          <Link to="/admin" className="text-white/70 hover:text-white">Admin</Link>
          <button type="button" className="text-white/70 hover:text-white" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
