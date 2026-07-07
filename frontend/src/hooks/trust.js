import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useAdminShopReports(status, enabled = true) {
  return useQuery({
    queryKey: ['admin-shop-reports', status],
    queryFn: async () => (await api.get('/admin/trust/reports', { params: status ? { status } : {} })).data,
    enabled,
  });
}

export function useResolveShopReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/trust/reports/resolve', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-reports'] }),
  });
}

export function useAdminTrustSettings(enabled = true) {
  return useQuery({
    queryKey: ['admin-trust-settings'],
    queryFn: async () => (await api.get('/admin/trust/settings')).data.settings,
    enabled,
  });
}

export function useUpdateAdminTrustSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/trust/settings', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-trust-settings'] }),
  });
}

export function useIssueUserCaution() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/users/caution', payload)).data,
  });
}
