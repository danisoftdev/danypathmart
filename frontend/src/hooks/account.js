import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

/** Current user's orders (newest first) with thumbnails + status. */
export function useOrders() {
  return useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => (await api.get('/orders')).data.data,
  });
}

/** Supported display currencies + their GHS rate (public). */
export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: async () => (await api.get('/public/currencies')).data.data,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (payload) => (await api.put('/users/profile', payload)).data,
    onSuccess: (data) => {
      if (data.user) useAuthStore.getState().setUser(data.user);
    },
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await api.post('/users/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.user) useAuthStore.getState().setUser(data.user);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/auth/change-password', payload)).data,
  });
}

export function useRequestEmailChange() {
  return useMutation({
    mutationFn: async ({ new_email, current_password }) =>
      (await api.post('/users/email/request-change', { new_email, current_password })).data,
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: async (otp) => (await api.post('/users/email/confirm-change', { otp })).data,
    onSuccess: (data) => {
      if (data.user) useAuthStore.getState().setUser(data.user);
    },
  });
}

export function useSetCurrency() {
  return useMutation({
    mutationFn: async (currency) => (await api.put('/users/currency', { currency })).data,
    onSuccess: (data) => {
      const u = useAuthStore.getState().user;
      if (u) useAuthStore.getState().setUser({ ...u, preferred_currency: data.preferred_currency });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await api.get('/users/sessions')).data.data,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/users/sessions/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useCredentials() {
  return useQuery({
    queryKey: ['credentials'],
    queryFn: async () => (await api.get('/auth/webauthn/credentials')).data.data,
  });
}

export function useRemoveCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/auth/webauthn/credentials/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credentials'] }),
  });
}

export function useDisable2FA() {
  return useMutation({
    mutationFn: async (totpCode) => (await api.post('/auth/2fa/disable', { totp_code: totpCode })).data,
    onSuccess: () => {
      const u = useAuthStore.getState().user;
      if (u) useAuthStore.getState().setUser({ ...u, totp_enabled: 0 });
    },
  });
}
