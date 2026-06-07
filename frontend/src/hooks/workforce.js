import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useAdminEmployees(enabled = true) {
  return useQuery({
    queryKey: ['admin-employees'],
    queryFn: async () => (await api.get('/admin/employees')).data.data ?? [],
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateEmployeeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/employees/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-employees'] });
      qc.invalidateQueries({ queryKey: ['admin-launch-readiness'] });
    },
  });
}

export function useAdminLeaveRequests(status = 'all', enabled = true) {
  return useQuery({
    queryKey: ['admin-leave-requests', status],
    queryFn: async () => {
      const params = status && status !== 'all' ? { status } : {};
      return (await api.get('/admin/leave-requests', { params })).data.data ?? [];
    },
    enabled,
    staleTime: 20_000,
  });
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/leave-requests', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-launch-readiness'] });
    },
  });
}

export function useUpdateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/leave-requests/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-launch-readiness'] });
    },
  });
}
