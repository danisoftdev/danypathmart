import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './components/routing/ProtectedRoute';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import GroupOrderPage from './pages/GroupOrderPage';
import GroupCheckoutPage from './pages/GroupCheckoutPage';
import KitBuilderPage from './pages/KitBuilderPage';
import KitsIndexPage from './pages/KitsIndexPage';
import SearchResultsPage from './pages/SearchResultsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardOverviewPage from './pages/dashboard/DashboardOverviewPage';
import OrdersPage from './pages/dashboard/OrdersPage';
import OrderDetailPage from './pages/dashboard/OrderDetailPage';
import QuotesPage from './pages/dashboard/QuotesPage';
import QuoteDetailPage from './pages/dashboard/QuoteDetailPage';
import DashboardSettingsPage from './pages/dashboard/DashboardSettingsPage';
import DashboardAddressesPage from './pages/dashboard/DashboardAddressesPage';
import DashboardSecurityPage from './pages/dashboard/DashboardSecurityPage';
import WishlistPage from './pages/dashboard/WishlistPage';
import WalletPage from './pages/dashboard/WalletPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import AdminLayout, { AdminIndexRedirect } from './components/layout/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminCustomProofsPage from './pages/admin/AdminCustomProofsPage';
import ImageAlertsPage from './pages/admin/ImageAlertsPage';
import CompanySettings from './pages/admin/CompanySettings';
import StaffAccounts from './pages/admin/StaffAccounts';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminSizeGuidesPage from './pages/admin/AdminSizeGuidesPage';
import AdminKitsPage from './pages/admin/AdminKitsPage';
import AdminQuotesPage from './pages/admin/AdminQuotesPage';
import AdminAlertsPage from './pages/admin/AdminAlertsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminContactInboxPage from './pages/admin/AdminContactInboxPage';
import AdminSupportChatPage from './pages/admin/AdminSupportChatPage';
import AdminJobPostsPage from './pages/admin/AdminJobPostsPage';
import AdminCareerApplicationsPage from './pages/admin/AdminCareerApplicationsPage';
import AdminPositionPermissionsPage from './pages/admin/AdminPositionPermissionsPage';
import AdminPickupStationsPage from './pages/admin/AdminPickupStationsPage';
import AdminHubLogisticsPage from './pages/admin/AdminHubLogisticsPage';
import AdminDeliveryRunsPage from './pages/admin/AdminDeliveryRunsPage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import AdminMarketplacePage from './pages/admin/AdminMarketplacePage';
import AdminTrustPage from './pages/admin/AdminTrustPage';
import DriverLayout from './components/layout/DriverLayout';
import DriverRunsPage from './pages/driver/DriverRunsPage';
import StationLayout from './components/layout/StationLayout';
import StationRepackPage, { StationReadyPage } from './pages/station/StationRepackPage';
import AdminStationStaffPage from './pages/admin/AdminStationStaffPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import ShopApplyPage from './pages/ShopApplyPage';
import StorePage from './pages/StorePage';
import StoreLayout from './components/layout/StoreLayout';
import StoreCartPage from './pages/StoreCartPage';
import StoreCheckoutPage from './pages/StoreCheckoutPage';
import StoresPage from './pages/StoresPage';
import ShopLayout from './components/layout/ShopLayout';
import ShopDashboardPage from './pages/seller/ShopDashboardPage';
import ShopProductsPage from './pages/seller/ShopProductsPage';
import ShopOrdersPage from './pages/seller/ShopOrdersPage';
import ShopPaymentsPage from './pages/seller/ShopPaymentsPage';
import ShopBillingPage from './pages/seller/ShopBillingPage';
import ShopSettingsPage from './pages/seller/ShopSettingsPage';
import ShopSupportChatPage from './pages/seller/ShopSupportChatPage';
import PromoterDashboardPage from './pages/promoter/PromoterDashboardPage';
import AdminShippingPage from './pages/admin/AdminShippingPage';
import AdminLaunchReadinessPage from './pages/admin/AdminLaunchReadinessPage';
import AdminPosSettingsPage from './pages/admin/AdminPosSettingsPage';
import AdminPosShiftsPage from './pages/admin/AdminPosShiftsPage';
import AdminPosReportsPage from './pages/admin/AdminPosReportsPage';
import AdminPosLabelsPage from './pages/admin/AdminPosLabelsPage';
import PosLayout from './components/layout/PosLayout';
import PosTerminalPage from './pages/pos/PosTerminalPage';
import ContactPage from './pages/ContactPage';
import ReturnsPolicyPage from './pages/ReturnsPolicyPage';
import LegalPolicyPage from './pages/LegalPolicyPage';
import AdminHeroBannersPage from './pages/admin/AdminHeroBannersPage';
import AdminLegalPoliciesPage from './pages/admin/AdminLegalPoliciesPage';
import AdminAboutPage from './pages/admin/AdminAboutPage';
import AboutPage from './pages/AboutPage';
import AdminEmployeesPage from './pages/admin/AdminEmployeesPage';
import AdminLeaveRequestsPage from './pages/admin/AdminLeaveRequestsPage';
import CareersPage from './pages/CareersPage';
import JobApplyPage from './pages/JobApplyPage';
import DriverSignupPage from './pages/DriverSignupPage';
import OAuthCallbackPage from './pages/auth/OAuthCallbackPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import TwoFactorVerifyPage from './pages/auth/TwoFactorVerifyPage';
import Setup2FAPage from './pages/admin/Setup2FAPage';
import { useAuthStore } from './store/authStore';
import { useCompanyStore } from './store/companyStore';
import AnalyticsLoader from './components/analytics/AnalyticsLoader';
import CautionAcknowledgeGate from './components/trust/CautionAcknowledgeGate';
import CookieConsentBanner from './components/legal/CookieConsentBanner';

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
  return (
    <>
      <AnalyticsLoader />
      <CautionAcknowledgeGate />
      <CookieConsentBanner />
      {children}
    </>
  );
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
          <Route path="/kits" element={<KitsIndexPage />} />
          <Route path="/kits/:slug" element={<KitBuilderPage />} />
          <Route path="/group-order" element={<GroupOrderPage />} />
          <Route
            path="/group-order/checkout"
            element={
              <ProtectedRoute>
                <GroupCheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/returns" element={<ReturnsPolicyPage />} />
          <Route path="/policies/:slug" element={<LegalPolicyPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/careers/drivers" element={<DriverSignupPage />} />
          <Route path="/careers/apply/:jobId" element={<JobApplyPage />} />
          <Route
            path="/sell"
            element={(
              <ProtectedRoute>
                <ShopApplyPage />
              </ProtectedRoute>
            )}
          />
          <Route path="/promoter" element={<PromoterDashboardPage />} />
          <Route path="/stores" element={<StoresPage />} />
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
            <Route index element={<DashboardOverviewPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="quotes/:id" element={<QuoteDetailPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<DashboardSettingsPage />} />
            <Route path="addresses" element={<DashboardAddressesPage />} />
            <Route path="security" element={<DashboardSecurityPage />} />
          </Route>
          <Route
            path="/driver"
            element={
              <ProtectedRoute>
                <DriverLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DriverRunsPage />} />
          </Route>
          <Route
            path="/station"
            element={
              <ProtectedRoute>
                <StationLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StationRepackPage />} />
            <Route path="ready" element={<StationReadyPage />} />
          </Route>
          <Route
            path="/seller"
            element={
              <ProtectedRoute>
                <ShopLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ShopDashboardPage />} />
            <Route path="products" element={<ShopProductsPage />} />
            <Route path="orders" element={<ShopOrdersPage />} />
            <Route path="chat" element={<ShopSupportChatPage />} />
            <Route path="billing" element={<ShopBillingPage />} />
            <Route path="payments" element={<ShopPaymentsPage />} />
            <Route path="wallet" element={<Navigate to="/seller/payments" replace />} />
            <Route path="settings" element={<ShopSettingsPage />} />
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
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="size-guides" element={<AdminSizeGuidesPage />} />
            <Route path="kits" element={<AdminKitsPage />} />
            <Route path="quotes" element={<AdminQuotesPage />} />
            <Route path="alerts" element={<AdminAlertsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="shipping" element={<AdminShippingPage />} />
            <Route path="custom-proofs" element={<AdminCustomProofsPage />} />
            <Route path="image-alerts" element={<ImageAlertsPage />} />
            <Route path="company-settings" element={<CompanySettings />} />
            <Route path="hero-banners" element={<AdminHeroBannersPage />} />
            <Route path="legal-policies" element={<AdminLegalPoliciesPage />} />
            <Route path="about-page" element={<AdminAboutPage />} />
            <Route path="employees" element={<AdminEmployeesPage />} />
            <Route path="leave-requests" element={<AdminLeaveRequestsPage />} />
            <Route path="launch-readiness" element={<AdminLaunchReadinessPage />} />
            <Route path="contact-inbox" element={<AdminContactInboxPage />} />
            <Route path="support-chat" element={<AdminSupportChatPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="job-posts" element={<AdminJobPostsPage />} />
            <Route path="career-applications" element={<AdminCareerApplicationsPage />} />
            <Route path="position-permissions" element={<AdminPositionPermissionsPage />} />
            <Route path="pickup-stations" element={<AdminPickupStationsPage />} />
            <Route path="hub-logistics" element={<AdminHubLogisticsPage />} />
            <Route path="delivery-runs" element={<AdminDeliveryRunsPage />} />
            <Route path="station-staff" element={<AdminStationStaffPage />} />
            <Route path="marketplace" element={<AdminMarketplacePage />} />
            <Route path="trust" element={<AdminTrustPage />} />
            <Route path="pos" element={<AdminPosSettingsPage />} />
            <Route path="pos/shifts" element={<AdminPosShiftsPage />} />
            <Route path="pos/reports" element={<AdminPosReportsPage />} />
            <Route path="pos/labels" element={<AdminPosLabelsPage />} />
            <Route path="staff" element={<StaffAccounts />} />
          </Route>
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <PosLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PosTerminalPage />} />
          </Route>
        </Route>

        {/* Isolated shop storefront — no main DPM marketplace chrome */}
        <Route path="/stores/:slug" element={<StoreLayout />}>
          <Route index element={<StorePage />} />
          <Route path="cart" element={<StoreCartPage />} />
          <Route
            path="checkout"
            element={(
              <ProtectedRoute>
                <StoreCheckoutPage />
              </ProtectedRoute>
            )}
          />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/oauth/callback" element={<OAuthCallbackPage />} />
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
