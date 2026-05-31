import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../lib/api';

export function useProducts(params = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => (await api.get('/products', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useProduct(slug) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => (await api.get(`/products/${slug}`)).data,
    enabled: !!slug,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data,
    staleTime: 5 * 60_000,
  });
}

export function useAutocomplete(query) {
  const q = (query || '').trim();
  return useQuery({
    queryKey: ['autocomplete', q],
    queryFn: async () => (await api.get('/search/autocomplete', { params: { q } })).data,
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}
