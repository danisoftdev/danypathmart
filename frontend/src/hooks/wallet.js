import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useWallet(options = {}) {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: async () => (await api.get('/wallet')).data,
    staleTime: 30_000,
    retry: false,
    ...options,
  });
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: ['payment-settings'],
    queryFn: async () => (await api.get('/public/payment-settings')).data,
    staleTime: 5 * 60_000,
  });
}
