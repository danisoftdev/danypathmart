import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useReferralInfo(enabled = true) {
  return useQuery({
    queryKey: ['referral'],
    queryFn: async () => (await api.get('/users/referral')).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useValidateReferralCode(code, enabled = true) {
  const normalized = String(code || '').trim();
  return useQuery({
    queryKey: ['referral-validate', normalized],
    queryFn: async () =>
      (await api.get('/public/referral/validate', { params: { code: normalized } })).data,
    enabled: enabled && normalized.length >= 4,
    staleTime: 30_000,
  });
}
