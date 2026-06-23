import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useAdminReviews(enabled = true) {
  return useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => (await api.get('/admin/reviews')).data,
    enabled,
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/reviews/moderate', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });
}

export function useUpdateMessagingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/messaging-settings/update', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-company-settings'] });
      qc.invalidateQueries({ queryKey: ['catalog-settings'] });
    },
  });
}

export function useSupportBotNodes(enabled = true) {
  return useQuery({
    queryKey: ['admin-support-bot'],
    queryFn: async () => (await api.get('/admin/support-bot')).data.data ?? [],
    enabled,
  });
}

export function useUpsertSupportBotNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/admin/support-bot/upsert', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-support-bot'] }),
  });
}

export function useShopSupportChats(enabled = true) {
  return useQuery({
    queryKey: ['shop-support-chats'],
    queryFn: async () => (await api.get('/shop/support')).data.data ?? [],
    enabled,
    refetchInterval: 10000,
  });
}

export function useShopSupportReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/shop/support/reply', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-support-chats'] }),
  });
}

export function useProductReviews(productId) {
  return useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: async () => (await api.get('/public/reviews', { params: { product_id: productId } })).data.data ?? [],
    enabled: !!productId,
  });
}

export function useSubmitProductReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/reviews/submit', payload)).data,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['product-reviews', vars.product_id] }),
  });
}

export function useSupportBotChoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/support-chat/bot-choice', payload, {
      headers: { 'X-Support-Guest-Token': localStorage.getItem('dpm_support_guest_token') || '' },
    })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-chat-thread'] }),
  });
}
