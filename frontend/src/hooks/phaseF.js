import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function useRestockAlertStatus(productId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['restock-alert', productId],
    queryFn: async () => (await api.get('/stock-alerts/status', { params: { product_id: productId } })).data,
    enabled: isAuthenticated && !!productId,
  });
}

export function useSubscribeRestockAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, club_tag }) =>
      (await api.post('/stock-alerts/subscribe', { product_id, club_tag })).data,
    onSuccess: (_, { product_id }) => {
      qc.invalidateQueries({ queryKey: ['restock-alert', product_id] });
    },
  });
}

export function useUnsubscribeRestockAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, club_tag }) =>
      (await api.post('/stock-alerts/unsubscribe', { product_id, club_tag })).data,
    onSuccess: (_, { product_id }) => {
      qc.invalidateQueries({ queryKey: ['restock-alert', product_id] });
    },
  });
}

export async function uploadCustomProof(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/custom-proofs/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
