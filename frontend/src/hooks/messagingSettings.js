import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useMessagingSettings(enabled = true) {
  return useQuery({
    queryKey: ['admin-messaging-settings'],
    queryFn: async () => (await api.get('/admin/messaging-settings')).data,
    enabled,
  });
}

export function useUpdateMessagingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/messaging-settings/update', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-messaging-settings'] });
      qc.invalidateQueries({ queryKey: ['admin-company-settings'] });
      qc.invalidateQueries({ queryKey: ['catalog-settings'] });
    },
  });
}

export function useSendManualMessage() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/messaging-settings/send-manual', payload)).data,
  });
}
