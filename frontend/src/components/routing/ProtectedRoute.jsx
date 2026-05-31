import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const ADMIN_ROLES = ['super_admin', 'staff'];

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Force admin/staff accounts to enrol in 2FA before using the app.
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  if (isAdmin && !user.totp_enabled && location.pathname !== '/admin/setup-2fa') {
    return <Navigate to="/admin/setup-2fa" replace />;
  }

  return children;
}
