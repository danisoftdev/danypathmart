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

export function useProductFacets() {
  return useQuery({
    queryKey: ['product-facets'],
    queryFn: async () => (await api.get('/products/facets')).data.facets,
    staleTime: 5 * 60_000,
  });
}

export function useFlashSale() {
  return useQuery({
    queryKey: ['flash-sale'],
    queryFn: async () => (await api.get('/public/flash-sale')).data.flash_sale,
    staleTime: 60_000,
  });
}

export function useKits() {
  return useQuery({
    queryKey: ['kits'],
    queryFn: async () => (await api.get('/kits')).data.data,
    staleTime: 5 * 60_000,
  });
}

export function useKit(slug) {
  return useQuery({
    queryKey: ['kit', slug],
    queryFn: async () => (await api.get(`/kits/${slug}`)).data.kit,
    enabled: !!slug,
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
