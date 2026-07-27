import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useCompanyStore } from '../store/companyStore';

function invalidatePolicyCaches(qc) {
  qc.invalidateQueries({ queryKey: ['checkout-policies'] });
  useCompanyStore.getState().load();
}

const publicQuery = {
  staleTime: 120_000,
  refetchOnWindowFocus: false,
};

export function usePublicHeroBanners() {
  return useQuery({
    queryKey: ['public-hero-banners'],
    queryFn: async () => (await api.get('/public/hero-banners')).data.data ?? [],
    ...publicQuery,
  });
}

export function usePublicLegalPolicies() {
  return useQuery({
    queryKey: ['public-legal-policies'],
    queryFn: async () => (await api.get('/public/legal-policies')).data.data ?? [],
    ...publicQuery,
  });
}

export function usePublicLegalPolicy(slug) {
  return useQuery({
    queryKey: ['public-legal-policy', slug],
    queryFn: async () => (await api.get(`/public/legal-policies/${slug}`)).data.policy,
    enabled: !!slug,
    ...publicQuery,
  });
}

export function useAdminHeroBanners(enabled = true) {
  return useQuery({
    queryKey: ['admin-hero-banners'],
    queryFn: async () => (await api.get('/admin/hero-banners')).data.data ?? [],
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateHeroBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/hero-banners', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hero-banners'] });
      qc.invalidateQueries({ queryKey: ['public-hero-banners'] });
    },
  });
}

export function useUpdateHeroBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/hero-banners/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hero-banners'] });
      qc.invalidateQueries({ queryKey: ['public-hero-banners'] });
    },
  });
}

export function useDeleteHeroBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/hero-banners/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-hero-banners'] });
      qc.invalidateQueries({ queryKey: ['public-hero-banners'] });
    },
  });
}

export function useUploadHeroImage() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('image', file);
      return (await api.post('/admin/hero-banners/upload-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    },
  });
}

export function useAdminLegalPolicies(enabled = true) {
  return useQuery({
    queryKey: ['admin-legal-policies'],
    queryFn: async () => (await api.get('/admin/legal-policies')).data.data ?? [],
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateLegalPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/legal-policies', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policy'] });
      invalidatePolicyCaches(qc);
    },
  });
}

export function useUpdateLegalPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => (await api.put(`/admin/legal-policies/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policy'] });
      invalidatePolicyCaches(qc);
    },
  });
}

export function useDeleteLegalPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/legal-policies/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policies'] });
      invalidatePolicyCaches(qc);
    },
  });
}

export function useUploadLegalPolicyAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`/admin/legal-policies/${id}/attachment`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policy'] });
      invalidatePolicyCaches(qc);
    },
  });
}

export function useDeleteLegalPolicyAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/legal-policies/${id}/attachment`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policies'] });
      qc.invalidateQueries({ queryKey: ['public-legal-policy'] });
      invalidatePolicyCaches(qc);
    },
  });
}

export function policyDownloadUrl(slug) {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return `${base}/public/legal-policies/${slug}/download`;
}
