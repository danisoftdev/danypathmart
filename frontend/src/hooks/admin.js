import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

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
