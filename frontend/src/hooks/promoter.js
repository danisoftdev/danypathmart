import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function usePromoterDashboard(enabled = true) {
  return useQuery({
    queryKey: ['promoter-dashboard'],
    queryFn: async () => (await api.get('/promoter/dashboard')).data,
    enabled,
    staleTime: 30_000,
  });
}

export function usePromoterWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/promoter/wallet/withdraw', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promoter-dashboard'] }),
  });
}
