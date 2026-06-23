import { useQuery } from '@tanstack/react-query';
import api from './api';

export function useCatalogSettings() {
  return useQuery({
    queryKey: ['catalog-settings'],
    queryFn: async () => (await api.get('/public/catalog-settings')).data,
    staleTime: 120_000,
  });
}
