import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const stationQuery = {
  retry: 1,
  staleTime: 10_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
};

export function useStationDashboard(enabled = true) {
  return useQuery({
    queryKey: ['station-dashboard'],
    queryFn: async () => (await api.get('/station/dashboard')).data,
    enabled,
    ...stationQuery,
  });
}

export function useStationQueue(queue, enabled = true) {
  return useQuery({
    queryKey: ['station-queue', queue],
    queryFn: async () => (await api.get('/station/queue', { params: { queue } })).data.data,
    enabled,
    ...stationQuery,
  });
}

export function useStationRepackComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/station/repack-complete', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['station-queue'] });
      qc.invalidateQueries({ queryKey: ['station-dashboard'] });
    },
  });
}

export function useStationCollect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/station/collect', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['station-queue'] });
      qc.invalidateQueries({ queryKey: ['station-dashboard'] });
    },
  });
}
