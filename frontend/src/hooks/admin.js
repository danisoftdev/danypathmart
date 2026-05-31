import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useCompanyStore } from '../store/companyStore';

export function useCompanySettings() {
  return useQuery({
    queryKey: ['admin-company-settings'],
    queryFn: async () => (await api.get('/admin/company-settings')).data.settings,
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.put('/admin/company-settings', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-company-settings'] });
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

export function useStaff() {
  return useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => (await api.get('/admin/staff')).data,
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
