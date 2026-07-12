import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { isDevAdminBypassEnabled } from '../../lib/devAdmin';

const ADMIN_ROLES = ['super_admin', 'staff'];

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search || ''}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-brand-green">
        Loading your account…
      </div>
    );
  }

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const has2FA = Number(user.totp_enabled) === 1;

  if (isAdmin && !has2FA && !isDevAdminBypassEnabled() && location.pathname !== '/admin/setup-2fa') {
    return <Navigate to="/admin/setup-2fa" replace />;
  }

  return children;
}
