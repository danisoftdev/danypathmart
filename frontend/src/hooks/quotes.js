import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useInstitutionalFeatures() {
  return useQuery({
    queryKey: ['institutional-features'],
    queryFn: async () => (await api.get('/public/institutional-features')).data,
    staleTime: 5 * 60_000,
  });
}

export function useQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => (await api.get('/quotes')).data.data,
  });
}

export function useQuote(id) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: async () => (await api.get(`/quotes/${id}`)).data.quote,
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/quotes', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useConvertQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.post(`/quotes/${id}/convert`, payload)).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useAdminQuotes(status = '') {
  return useQuery({
    queryKey: ['admin-quotes', status],
    queryFn: async () =>
      (await api.get('/admin/quotes', { params: status ? { status } : {} })).data.data,
  });
}

export function useAdminQuote(id) {
  return useQuery({
    queryKey: ['admin-quote', id],
    queryFn: async () => (await api.get(`/admin/quotes/${id}`)).data,
    enabled: !!id,
  });
}

export function useSendProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.post(`/admin/quotes/${id}/proforma`, payload)).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-quote', id] });
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
    },
  });
}

export function useApprovePayLater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) =>
      (await api.post(`/admin/quotes/${id}/approve-pay-later`, payload)).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-quote', id] });
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
    },
  });
}

export function useRejectQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      (await api.post(`/admin/quotes/${id}/reject`, { reason })).data,
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-quote', id] });
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
    },
  });
}
