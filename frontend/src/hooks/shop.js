import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useShopDashboard(enabled = true) {
  return useQuery({
    queryKey: ['shop-dashboard'],
    queryFn: async () => (await api.get('/shop/dashboard')).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useShopProducts(enabled = true) {
  return useQuery({
    queryKey: ['shop-products'],
    queryFn: async () => (await api.get('/shop/products')).data.data,
    enabled,
  });
}

export function useCreateShopProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/shop/products', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-products'] }),
  });
}

export function useUpdateShopProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/shop/products/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-products'] }),
  });
}

export function useShopOrders(enabled = true) {
  return useQuery({
    queryKey: ['shop-orders'],
    queryFn: async () => (await api.get('/shop/orders')).data.data,
    enabled,
  });
}

export function useShopOrderDetail(id, enabled = true) {
  return useQuery({
    queryKey: ['shop-order', id],
    queryFn: async () => (await api.get(`/shop/orders/${id}`)).data,
    enabled: enabled && !!id,
  });
}

export function useUpdateShopOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }) =>
      (await api.post(`/shop/orders/${id}/status`, { status, note })).data,
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['shop-orders'] });
      qc.invalidateQueries({ queryKey: ['shop-order', id] });
    },
  });
}

export function useShopWallet(enabled = true) {
  return useQuery({
    queryKey: ['shop-wallet'],
    queryFn: async () => (await api.get('/shop/wallet')).data,
    enabled,
  });
}

export function useShopWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/shop/wallet/withdraw', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-wallet'] });
      qc.invalidateQueries({ queryKey: ['shop-dashboard'] });
    },
  });
}

export function useValidateShopReferralCode(code, enabled = true) {
  const normalized = String(code || '').trim();
  return useQuery({
    queryKey: ['shop-referral-validate', normalized],
    queryFn: async () =>
      (await api.get('/public/shop-referral/validate', { params: { code: normalized } })).data,
    enabled: enabled && normalized.length >= 2,
    staleTime: 60_000,
  });
}

export function useApplyForShop() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/shop-applications/apply', payload)).data,
  });
}

export function useShopBillingSettings(enabled = true) {
  return useQuery({
    queryKey: ['shop-billing-settings'],
    queryFn: async () => (await api.get('/public/shop-billing/settings')).data.settings,
    enabled,
    staleTime: 60_000,
  });
}

export function useShopRegistrationQuote(email, referralCode, enabled = true) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const code = String(referralCode || '').trim();
  return useQuery({
    queryKey: ['shop-registration-quote', normalizedEmail, code],
    queryFn: async () =>
      (
        await api.get('/public/shop-billing/registration-quote', {
          params: {
            email: normalizedEmail || undefined,
            referral_code: code.length >= 2 ? code : undefined,
          },
        })
      ).data.quote,
    enabled: enabled && normalizedEmail.includes('@'),
    staleTime: 15_000,
  });
}

export function useInitializeShopRegistrationPayment() {
  return useMutation({
    mutationFn: async (payload) =>
      (await api.post('/public/shop-billing/initialize-registration', payload)).data,
  });
}

export function useConfirmShopBillingDevPayment() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/shop-billing/dev-confirm', payload)).data,
  });
}

export function useInitializeShopRenewalPayment() {
  return useMutation({
    mutationFn: async () => (await api.post('/shop/billing/initialize-renewal')).data,
  });
}

async function uploadShopImageFile(endpoint, file) {
  const fd = new FormData();
  fd.append('image', file);
  const { data } = await api.post(endpoint, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export function useUploadShopApplicationLogo() {
  return useMutation({
    mutationFn: (file) => uploadShopImageFile('/public/shop-applications/upload-image', file),
  });
}

export function useUploadShopLogo() {
  return useMutation({
    mutationFn: (file) => uploadShopImageFile('/shop/upload-image', file),
  });
}

export function useShopProfile(enabled = true) {
  return useQuery({
    queryKey: ['shop-profile'],
    queryFn: async () => (await api.get('/shop/profile')).data.shop,
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateShopProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put('/shop/profile', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-profile'] });
      qc.invalidateQueries({ queryKey: ['shop-dashboard'] });
      qc.invalidateQueries({ queryKey: ['public-store'] });
    },
  });
}

export function usePublicStore(slug) {
  return useQuery({
    queryKey: ['public-store', slug],
    queryFn: async () => (await api.get(`/public/shops/${slug}`)).data,
    enabled: !!slug,
  });
}

export function useHasShopDashboard() {
  return useQuery({
    queryKey: ['shop-dashboard'],
    queryFn: async () => (await api.get('/shop/dashboard')).data,
    retry: false,
    staleTime: 60_000,
  });
}

export function useUpdateShopPaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put('/shop/payment-settings', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-profile'] });
      qc.invalidateQueries({ queryKey: ['shop-dashboard'] });
      qc.invalidateQueries({ queryKey: ['public-store'] });
    },
  });
}

export function useMarkShopOrderPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fulfillmentId) =>
      (await api.post(`/shop/orders/${fulfillmentId}/mark-paid`)).data,
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['shop-orders'] });
      qc.invalidateQueries({ queryKey: ['shop-order', id] });
    },
  });
}
