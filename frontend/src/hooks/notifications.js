import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { canUseNotifications, notificationPollMs } from '../lib/notifications';

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const enabled = isAuthenticated && canUseNotifications(user);

  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
    enabled,
    retry: false,
    refetchInterval: enabled ? notificationPollMs(user) : false,
    staleTime: 10_000,
  });
}

export function useNotificationCount() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const enabled = isAuthenticated && canUseNotifications(user);

  return useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => (await api.get('/notifications/count')).data.unread_count,
    enabled,
    retry: false,
    refetchInterval: enabled ? notificationPollMs(user) : false,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids) =>
      (await api.post('/notifications/read', ids?.length ? { ids } : {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });
}

export function useDeleteNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, singleId }) => {
      if (singleId) {
        return (await api.delete(`/notifications/${singleId}`)).data;
      }
      return (await api.post('/notifications/delete', { ids })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });
}
