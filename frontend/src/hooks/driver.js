import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const driverQuery = {
  retry: 1,
  staleTime: 10_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
};

export function useDriverRuns(enabled = true) {
  return useQuery({
    queryKey: ['driver-runs'],
    queryFn: async () => (await api.get('/driver/runs')).data.data,
    enabled,
    ...driverQuery,
  });
}

export function useConfirmDriverStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, orderId, note }) =>
      (await api.post(`/driver/runs/${runId}/confirm-stop`, { order_id: orderId, note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-runs'] }),
  });
}
