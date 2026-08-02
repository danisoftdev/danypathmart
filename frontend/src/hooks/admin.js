import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '../lib/api';
import { PERMISSION_GROUPS, PERMISSION_LABELS, PERMISSION_KEYS } from '../lib/permissions';
import { useCompanyStore } from '../store/companyStore';

const adminQuery = {
  retry: 1,
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
};
export function useCompanySettings() {
  return useQuery({
    queryKey: ['admin-company-settings'],
    queryFn: async () => (await api.get('/admin/company-settings')).data.settings,
    ...adminQuery,
  });
}

export function useLaunchReadiness(enabled = true) {
  return useQuery({
    queryKey: ['admin-launch-readiness'],
    queryFn: async () => (await api.get('/admin/launch-readiness')).data,
    enabled,
    staleTime: 30_000,
    ...adminQuery,
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put('/admin/company-settings', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-company-settings'] });
      qc.invalidateQueries({ queryKey: ['checkout-policies'] });
      // Refresh the public company info so the footer reflects changes immediately.
      useCompanyStore.getState().load();
    },
  });
}

export function useImageAlerts(status = '') {
  return useQuery({
    queryKey: ['admin-image-alerts', status],
    queryFn: async () =>
      (await api.get('/admin/image-alerts', { params: status ? { status } : {} })).data,
    placeholderData: keepPreviousData,
    ...adminQuery,
  });
}

export function useAlertCount(enabled = true) {
  return useQuery({
    queryKey: ['admin-alert-count'],
    queryFn: async () => (await api.get('/admin/image-alerts/count')).data,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useUpdateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, admin_note }) =>
      (await api.post(`/admin/image-alerts/${id}`, { status, admin_note })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-image-alerts'] });
      qc.invalidateQueries({ queryKey: ['admin-alert-count'] });
    },
  });
}

export function useCustomProofs(status = '', orderId) {
  return useQuery({
    queryKey: ['admin-custom-proofs', status, orderId],
    queryFn: async () =>
      (await api.get('/admin/custom-proofs', {
        params: {
          ...(status ? { status } : {}),
          ...(orderId ? { order_id: orderId } : {}),
        },
      })).data.data,
  });
}

export function useReviewCustomProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, admin_note }) =>
      (await api.post(`/admin/custom-proofs/${id}`, { status, admin_note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-custom-proofs'] }),
  });
}

export function useStaff(enabled = true) {
  return useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => (await api.get('/admin/staff')).data,
    enabled,
    placeholderData: keepPreviousData,
    ...adminQuery,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/staff', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
  });
}

export function useUpdateStaffPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role_name, permissions }) =>
      (await api.put(`/admin/staff/${id}/permissions`, { role_name, permissions })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/staff/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
  });
}

export function usePermissionCatalog() {
  const { data } = useQuery({
    queryKey: ['admin-permission-catalog'],
    queryFn: async () => (await api.get('/admin/staff/permission-catalog')).data,
    staleTime: 10 * 60_000,
    ...adminQuery,
  });
  return {
    keys: data?.keys?.length ? data.keys : PERMISSION_KEYS,
    labels: Object.keys(data?.labels || {}).length ? data.labels : PERMISSION_LABELS,
    groups: data?.groups?.length ? data.groups : PERMISSION_GROUPS,
  };
}

export function usePositionPermissions(enabled = true) {
  return useQuery({
    queryKey: ['admin-position-permissions'],
    queryFn: async () => (await api.get('/admin/position-permissions')).data.data,
    enabled,
    ...adminQuery,
  });
}

export function useUpdatePositionPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, permissions }) =>
      (await api.put(`/admin/position-permissions/${slug}`, { permissions })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-position-permissions'] }),
  });
}

export function useHireFromApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ applicationId, ...payload }) =>
      (await api.post(`/admin/career-applications/${applicationId}/hire`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-career-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-career-application'] });
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-station-staff'] });
      qc.invalidateQueries({ queryKey: ['admin-drivers'] });
    },
  });
}

export function useAdminPickupStations(enabled = true) {
  return useQuery({
    queryKey: ['admin-pickup-stations'],
    queryFn: async () => (await api.get('/admin/pickup-stations')).data.data,
    enabled,
    ...adminQuery,
  });
}

export function useCreatePickupStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/pickup-stations', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pickup-stations'] });
      qc.invalidateQueries({ queryKey: ['pickup-stations'] });
    },
  });
}

export function useUpdatePickupStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/pickup-stations/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pickup-stations'] });
      qc.invalidateQueries({ queryKey: ['pickup-stations'] });
    },
  });
}

export function useDeletePickupStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/pickup-stations/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pickup-stations'] });
      qc.invalidateQueries({ queryKey: ['pickup-stations'] });
    },
  });
}

export function useAdminShopApplications(enabled = true) {
  return useQuery({
    queryKey: ['admin-shop-applications'],
    queryFn: async () => (await api.get('/admin/shop-applications')).data,
    enabled,
    ...adminQuery,
  });
}

export function useApproveShopApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admin_note }) =>
      (await api.post(`/admin/shop-applications/${id}/approve`, { admin_note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-applications'] }),
  });
}

export function useRejectShopApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admin_note }) =>
      (await api.post(`/admin/shop-applications/${id}/reject`, { admin_note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-applications'] }),
  });
}

export function useDeleteShopApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/shop-applications/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-shop-policy-acceptances'] });
    },
  });
}

export function useAdminShops(enabled = true) {
  return useQuery({
    queryKey: ['admin-shops'],
    queryFn: async () => (await api.get('/admin/shops')).data.data,
    enabled,
    ...adminQuery,
  });
}

export function useCreateAdminShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/shops', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shops'] }),
  });
}

export function usePreapproveShopApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/shop-applications/preapprove', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
    },
  });
}

export function useCreateShopInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/shop-invites', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-applications'] }),
  });
}

/** Policy acceptances from applications list (filter client-side). */
export function useShopPolicyAcceptances(enabled = true) {
  return useQuery({
    queryKey: ['admin-shop-policy-acceptances'],
    queryFn: async () => {
      const res = await api.get('/admin/shop-applications');
      const apps = res.data?.data ?? [];
      return apps.filter((a) => a.accepted_policies_at || a.accepted_terms || a.accepted_privacy || a.accepted_seller_policy);
    },
    enabled,
    ...adminQuery,
  });
}

export function useUpdateAdminShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/shops/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shops'] }),
  });
}

export function useDeleteAdminShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirm_name }) =>
      (await api.delete(`/admin/shops/${id}`, { data: { confirm_name } })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
      qc.invalidateQueries({ queryKey: ['admin-shop-billing'] });
      qc.invalidateQueries({ queryKey: ['admin-shop-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-shop-policy-acceptances'] });
      qc.invalidateQueries({ queryKey: ['admin-marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['public-shops'] });
      qc.invalidateQueries({ queryKey: ['public-store'] });
      qc.invalidateQueries({ queryKey: ['shop-dashboard'] });
    },
  });
}

export function useMarketplaceListings(listing = 'pending', enabled = true) {
  return useQuery({
    queryKey: ['admin-marketplace-listings', listing],
    queryFn: async () =>
      (await api.get('/admin/marketplace/listings', { params: { listing } })).data.data,
    enabled,
    ...adminQuery,
  });
}

export function useReviewMarketplaceListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, note }) =>
      (await api.post(`/admin/marketplace/listings/${id}/review`, { action, note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-marketplace-listings'] }),
  });
}

export function useModerateListingBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }) =>
      (await api.post(`/admin/marketplace/listings/${id}/moderate-badge`, { action })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-marketplace-listings'] }),
  });
}

export function useAdminShopWithdrawals(status = 'requested', enabled = true) {
  return useQuery({
    queryKey: ['admin-shop-withdrawals', status],
    queryFn: async () =>
      (await api.get('/admin/shop-withdrawals', { params: { status } })).data.data,
    enabled,
    ...adminQuery,
  });
}

export function useProcessShopWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, admin_note }) =>
      (await api.post(`/admin/shop-withdrawals/${id}/process`, { action, admin_note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-withdrawals'] }),
  });
}

export function useAdminShopBilling(enabled = true) {
  return useQuery({
    queryKey: ['admin-shop-billing'],
    queryFn: async () => (await api.get('/admin/shop-billing')).data,
    enabled,
    ...adminQuery,
  });
}

export function useUpdateShopBillingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/shop-billing/update-settings', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-billing'] });
      qc.invalidateQueries({ queryKey: ['admin-company-settings'] });
    },
  });
}

export function useUpdateShopRegistrationPromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/shop-billing/update-promo', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-billing'] });
      qc.invalidateQueries({ queryKey: ['shop-billing-settings'] });
    },
  });
}

export function useUpdateReferralRegistrationDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/shop-billing/update-referral-discount', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-billing'] });
      qc.invalidateQueries({ queryKey: ['shop-billing-settings'] });
    },
  });
}

export function useWaiveShopApplicationFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ application_id, note }) =>
      (await api.post('/admin/shop-billing/waive-application', { application_id, note })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-billing'] });
      qc.invalidateQueries({ queryKey: ['admin-shop-applications'] });
    },
  });
}

export function useWaiveShopRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shop_id, note, until }) =>
      (await api.post('/admin/shop-billing/waive-shop', { shop_id, note, until })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shop-billing'] });
      qc.invalidateQueries({ queryKey: ['admin-shops'] });
    },
  });
}

export function useAdminOrders(params = {}) {
  return useQuery({
    queryKey: ['admin-orders', params],
    queryFn: async () => (await api.get('/admin/orders', { params })).data.data,
    placeholderData: keepPreviousData,
    ...adminQuery,
  });
}

export function useAdminOrder(id) {
  return useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => (await api.get(`/admin/orders/${id}`)).data.order,
    enabled: !!id,
    ...adminQuery,
  });
}

export function useUpdateAdminOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }) =>
      (await api.post(`/admin/orders/${id}/status`, { status, note })).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
    },
  });
}

export function useReviveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      (await api.post(`/admin/orders/${id}/revive`, { reason })).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
    },
  });
}

export function useConfirmBankTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) =>
      (await api.post(`/admin/orders/${id}/confirm-bank-transfer`)).data,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
    },
  });
}

export function useRefundOrderToWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, reason }) =>
      (await api.post(`/admin/orders/${id}/wallet-refund`, { amount, reason })).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
    },
  });
}

export function useAdminUsers(params = {}) {
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: async () => (await api.get('/admin/users', { params })).data.data,
    placeholderData: keepPreviousData,
    ...adminQuery,
  });
}

export function useUpdateCustomerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) =>
      (await api.put(`/admin/users/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirm_email }) =>
      (await api.delete(`/admin/users/${id}`, { data: { confirm_email } })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useAdminShipping() {
  return useQuery({
    queryKey: ['admin-shipping'],
    queryFn: async () => (await api.get('/admin/shipping')).data.settings,
    ...adminQuery,
  });
}

export function useUpdateAdminShipping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put('/admin/shipping', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shipping'] }),
  });
}

export function useAdminReports() {
  return useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => (await api.get('/admin/reports/summary')).data.summary,
    placeholderData: keepPreviousData,
    ...adminQuery,
  });
}

export function useAdminFinancialReports() {
  return useQuery({
    queryKey: ['admin-reports-financial'],
    queryFn: async () => (await api.get('/admin/reports/financial')).data.financial,
    placeholderData: keepPreviousData,
    ...adminQuery,
  });
}

export function useAdminProducts(params = {}, queryOptions = {}) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: async () => (await api.get('/admin/products', { params })).data.data,
    placeholderData: keepPreviousData,
    ...adminQuery,
    ...queryOptions,
  });
}

export function useUploadProductImage() {
  return useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/admin/products/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}

export function useCreateAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/products', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['product-facets'] });
    },
  });
}

export function useResetAdminStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/products/reset-stock', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-financial-reports'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.put(`/admin/products/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['product-facets'] });
    },
  });
}

export function useDeleteAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/products/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['product-facets'] });
    },
  });
}

export function useFlashSaleSettings() {
  return useQuery({
    queryKey: ['admin-flash-sale'],
    queryFn: async () => (await api.get('/admin/flash-sale')).data.flash_sale,
    ...adminQuery,
  });
}

export function useUpdateFlashSaleSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put('/admin/flash-sale', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-flash-sale'] });
      qc.invalidateQueries({ queryKey: ['flash-sale'] });
    },
  });
}

export function useAdminBroadcasts() {
  return useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: async () => (await api.get('/admin/notifications')).data.data,
    ...adminQuery,
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/notifications/send', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-broadcasts'] }),
  });
}

export function useAdminContactInbox(params = {}) {
  return useQuery({
    queryKey: ['admin-contact-inbox', params],
    queryFn: async () => (await api.get('/admin/contact-inbox', { params })).data,
    refetchInterval: 60_000,
    ...adminQuery,
  });
}

export function useContactInboxCount(enabled = true) {
  return useQuery({
    queryKey: ['admin-contact-inbox-count'],
    queryFn: async () => (await api.get('/admin/contact-inbox/count')).data.unread_count,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMarkContactRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }) => (await api.post('/admin/contact-inbox/read', ids?.length ? { ids } : {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact-inbox'] });
      qc.invalidateQueries({ queryKey: ['admin-contact-inbox-count'] });
    },
  });
}

export function useDeleteContactMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }) => {
      if (ids.length === 1) {
        return (await api.delete(`/admin/contact-inbox/${ids[0]}`)).data;
      }
      return (await api.post('/admin/contact-inbox/delete', { ids })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact-inbox'] });
      qc.invalidateQueries({ queryKey: ['admin-contact-inbox-count'] });
    },
  });
}

export function useUploadCategoryImage() {
  return useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/admin/categories/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/categories', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.put(`/admin/categories/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/categories/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useSizeGuides() {
  return useQuery({
    queryKey: ['admin-size-guides'],
    queryFn: async () => (await api.get('/admin/size-guides')).data.data,
    ...adminQuery,
  });
}

export function useSizeGuide(id) {
  return useQuery({
    queryKey: ['admin-size-guide', id],
    queryFn: async () => (await api.get(`/admin/size-guides/${id}`)).data.guide,
    enabled: !!id,
    ...adminQuery,
  });
}

export function useCreateSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/size-guides', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-size-guides'] }),
  });
}

export function useUpdateSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.put(`/admin/size-guides/${id}`, payload)).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-size-guides'] });
      qc.invalidateQueries({ queryKey: ['admin-size-guide', id] });
    },
  });
}

export function useDeleteSizeGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/size-guides/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-size-guides'] }),
  });
}

export function useAdminKits() {
  return useQuery({
    queryKey: ['admin-kits'],
    queryFn: async () => (await api.get('/admin/kits')).data.data,
    ...adminQuery,
  });
}

export function useAdminKit(id) {
  return useQuery({
    queryKey: ['admin-kit', id],
    queryFn: async () => (await api.get(`/admin/kits/${id}`)).data.kit,
    enabled: !!id,
    ...adminQuery,
  });
}

export function useCreateKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/kits', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-kits'] });
      qc.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}

export function useUpdateKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/kits/${id}`, payload)).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-kits'] });
      qc.invalidateQueries({ queryKey: ['admin-kit', id] });
      qc.invalidateQueries({ queryKey: ['kits'] });
      qc.invalidateQueries({ queryKey: ['kit'] });
    },
  });
}

export function useDeleteKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/kits/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-kits'] });
      qc.invalidateQueries({ queryKey: ['kits'] });
    },
  });
}

export function useAdminJobPosts() {
  return useQuery({
    queryKey: ['admin-job-posts'],
    queryFn: async () => (await api.get('/admin/job-posts')).data,
    ...adminQuery,
  });
}

export function useJobRoleTypes() {
  return useQuery({
    queryKey: ['admin-job-role-types'],
    queryFn: async () => (await api.get('/admin/job-role-types')).data.data,
    ...adminQuery,
  });
}

export function useCreateJobPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/job-posts', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-job-posts'] });
      qc.invalidateQueries({ queryKey: ['admin-job-role-types'] });
      qc.invalidateQueries({ queryKey: ['public-careers'] });
    },
  });
}

export function useUpdateJobPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/job-posts/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-job-posts'] });
      qc.invalidateQueries({ queryKey: ['admin-job-role-types'] });
      qc.invalidateQueries({ queryKey: ['public-careers'] });
    },
  });
}

export function useDeleteJobPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/job-posts/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-job-posts'] });
      qc.invalidateQueries({ queryKey: ['public-careers'] });
    },
  });
}

export function useAdminCareerApplications(params = {}) {
  return useQuery({
    queryKey: ['admin-career-applications', params],
    queryFn: async () => (await api.get('/admin/career-applications', { params })).data,
    refetchInterval: 60_000,
    ...adminQuery,
  });
}

export function useCareerApplicationsCount(enabled = true) {
  return useQuery({
    queryKey: ['admin-career-applications-count'],
    queryFn: async () => (await api.get('/admin/career-applications/count')).data.unread_count,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMarkCareerApplicationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }) =>
      (await api.post('/admin/career-applications/read', ids?.length ? { ids } : {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-career-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-career-applications-count'] });
    },
  });
}

export function useDeleteCareerApplications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }) => {
      if (ids.length === 1) {
        return (await api.delete(`/admin/career-applications/${ids[0]}`)).data;
      }
      return (await api.post('/admin/career-applications/delete', { ids })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-career-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-career-applications-count'] });
    },
  });
}

export function useAdminCareerApplication(id, enabled = true) {
  return useQuery({
    queryKey: ['admin-career-application', id],
    queryFn: async () => (await api.get(`/admin/career-applications/${id}`)).data.application,
    enabled: enabled && !!id,
    ...adminQuery,
  });
}

export function useAdminHubQueue(queue, enabled = true) {
  return useQuery({
    queryKey: ['admin-hub-logistics', queue],
    queryFn: async () => (await api.get('/admin/hub-logistics', { params: { queue } })).data.data,
    enabled,
    ...adminQuery,
    staleTime: 15_000,
  });
}

export function useHubReceiveOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/hub-logistics/receive', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hub-logistics'] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
}

export function useHubMarkReadyForPickup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/hub-logistics/mark-ready', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hub-logistics'] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
}

export function useAdminDeliveryRuns(status, enabled = true) {
  return useQuery({
    queryKey: ['admin-delivery-runs', status],
    queryFn: async () => (await api.get('/admin/delivery-runs', { params: status ? { status } : {} })).data.data,
    enabled,
    ...adminQuery,
    staleTime: 15_000,
  });
}

export function useAdminDeliveryRun(id, enabled = true) {
  return useQuery({
    queryKey: ['admin-delivery-run', id],
    queryFn: async () => (await api.get(`/admin/delivery-runs/${id}`)).data.run,
    enabled: enabled && !!id,
    ...adminQuery,
  });
}

export function useCreateDeliveryRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/delivery-runs', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-delivery-runs'] });
      qc.invalidateQueries({ queryKey: ['admin-hub-logistics'] });
    },
  });
}

export function useDispatchDeliveryRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/admin/delivery-runs/${id}/dispatch`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-delivery-runs'] });
      qc.invalidateQueries({ queryKey: ['admin-delivery-run'] });
    },
  });
}

export function useAdminDrivers(enabled = true) {
  return useQuery({
    queryKey: ['admin-drivers'],
    queryFn: async () => (await api.get('/admin/drivers')).data.data,
    enabled,
    ...adminQuery,
  });
}

export function useCreateDriverAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/drivers', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-drivers'] }),
  });
}

export function useDeleteDriverAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirm_email }) =>
      (await api.delete(`/admin/drivers/${id}`, { data: { confirm_email } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-drivers'] }),
  });
}

export function useAdminStationStaff(enabled = true) {
  return useQuery({
    queryKey: ['admin-station-staff'],
    queryFn: async () => (await api.get('/admin/station-staff')).data.data,
    enabled,
    ...adminQuery,
  });
}

export function useCreateStationStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/station-staff', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-station-staff'] }),
  });
}

export function useDeleteStationStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirm_email }) =>
      (await api.delete(`/admin/station-staff/${id}`, { data: { confirm_email } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-station-staff'] }),
  });
}

export function useAdminPromoters(enabled = true) {
  return useQuery({
    queryKey: ['admin-promoters'],
    queryFn: async () => (await api.get('/admin/promoters')).data.promoters,
    enabled,
    ...adminQuery,
  });
}

export function useAdminPromoterApplications(status = 'new', enabled = true) {
  return useQuery({
    queryKey: ['admin-promoter-applications', status],
    queryFn: async () =>
      (await api.get('/admin/promoter-applications', { params: { status } })).data.applications,
    enabled,
    ...adminQuery,
  });
}

export function useApprovePromoterApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, code }) =>
      (await api.post(`/admin/promoter-applications/${id}/approve`, code ? { code } : {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-promoter-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-promoters'] });
    },
  });
}

export function useRejectPromoterApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admin_note }) =>
      (await api.post(`/admin/promoter-applications/${id}/reject`, { admin_note: admin_note || null })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promoter-applications'] }),
  });
}

export function useCreatePromoter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/promoters', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promoters'] }),
  });
}

export function useUpdatePromoterStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => (await api.post(`/admin/promoters/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promoters'] }),
  });
}

export function useDeletePromoter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirm_email }) =>
      (await api.post(`/admin/promoters/${id}/delete`, { confirm_email })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-promoters'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-promoter-applications'] });
    },
  });
}

export function useAdminPromoterWithdrawals(status = '', enabled = true) {
  return useQuery({
    queryKey: ['admin-promoter-withdrawals', status],
    queryFn: async () =>
      (await api.get('/admin/promoter-withdrawals', { params: status ? { status } : {} })).data.withdrawals,
    enabled,
    ...adminQuery,
  });
}

export function useProcessPromoterWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, admin_note }) =>
      (await api.post(`/admin/promoter-withdrawals/${id}/process`, { action, admin_note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promoter-withdrawals'] }),
  });
}
