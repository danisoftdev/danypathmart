import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function usePublicCareers() {
  return useQuery({
    queryKey: ['public-careers'],
    queryFn: async () => (await api.get('/public/careers')).data,
    retry: false,
    staleTime: 60_000,
  });
}

export function usePublicJob(jobId, enabled = true) {
  return useQuery({
    queryKey: ['public-job', jobId],
    queryFn: async () => (await api.get(`/public/careers/${jobId}`)).data,
    enabled: enabled && !!jobId,
    retry: false,
  });
}

export function useApplyForJob() {
  return useMutation({
    mutationFn: async (formData) =>
      (
        await api.post('/public/careers/apply', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
  });
}
