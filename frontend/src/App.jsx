import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './components/routing/ProtectedRoute';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import SearchResultsPage from './pages/SearchResultsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import DashboardLayout from './components/layout/DashboardLayout';
import OrdersPage from './pages/dashboard/OrdersPage';
import OrderDetailPage from './pages/dashboard/OrderDetailPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import AdminLayout, { AdminIndexRedirect } from './components/layout/AdminLayout';
import ImageAlertsPage from './pages/admin/ImageAlertsPage';
import CompanySettings from './pages/admin/CompanySettings';
import StaffAccounts from './pages/admin/StaffAccounts';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminShippingPage from './pages/admin/AdminShippingPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import TwoFactorVerifyPage from './pages/auth/TwoFactorVerifyPage';
import Setup2FAPage from './pages/admin/Setup2FAPage';
import { useAuthStore } from './store/authStore';
import { useCompanyStore } from './store/companyStore';

function Boot({ children }) {
  const [ready, setReady] = useState(false);
  const loadMe = useAuthStore((s) => s.loadMe);
  const loadCompany = useCompanyStore((s) => s.load);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.allSettled([loadMe(), loadCompany()]);
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-green">
        Loading DanyPathMart...
      </div>
    );
  }
  return children;
}

export default function App() {
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    const handler = () => {
      reset();
      window.location.assign('/login');
    };
    window.addEventListener('dpm:auth-expired', handler);
    return () => window.removeEventListener('dpm:auth-expired', handler);
  }, [reset]);

  return (
    <Boot>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route
            path="/order/:id"
            element={
              <ProtectedRoute>
                <OrderConfirmationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminIndexRedirect />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="shipping" element={<AdminShippingPage />} />
            <Route path="image-alerts" element={<ImageAlertsPage />} />
            <Route path="company-settings" element={<CompanySettings />} />
            <Route path="staff" element={<StaffAccounts />} />
          </Route>
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/2fa" element={<TwoFactorVerifyPage />} />
          <Route
            path="/admin/setup-2fa"
            element={
              <ProtectedRoute>
                <Setup2FAPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Boot>
  );
}
