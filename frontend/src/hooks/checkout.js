import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

/** Server-authoritative shipping/total quote for the given cart lines. */
export function useShippingQuote(items, enabled = true) {
  return useQuery({
    queryKey: ['shipping', items],
    queryFn: async () => (await api.post('/shipping/calculate', { items })).data,
    enabled: enabled && Array.isArray(items) && items.length > 0,
    staleTime: 30_000,
  });
}

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/addresses')).data,
    enabled,
  });
}

export function useAddAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/addresses', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async ({ items, address_id, notes }) =>
      (await api.post('/orders', { items, address_id, notes })).data,
  });
}

export function useOrder(orderId) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => (await api.get(`/orders/${orderId}`)).data,
    enabled: !!orderId,
  });
}

export function useInitPayment() {
  return useMutation({
    mutationFn: async (orderId) =>
      (await api.post('/payments/initialize', { order_id: orderId })).data,
  });
}

/** Development-only: simulate a successful Paystack charge. */
export function useDevConfirm() {
  return useMutation({
    mutationFn: async (orderId) =>
      (await api.post('/payments/dev-confirm', { order_id: orderId })).data,
  });
}
