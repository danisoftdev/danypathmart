import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getToken } from '../lib/api';

const EPHEMERAL_KEY = 'dpm_support_ephemeral';

export function getEphemeralChat() {
  try {
    const raw = sessionStorage.getItem(EPHEMERAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveEphemeralChat(state) {
  sessionStorage.setItem(EPHEMERAL_KEY, JSON.stringify(state));
}

export function clearEphemeralChat() {
  sessionStorage.removeItem(EPHEMERAL_KEY);
}

export function useSupportChatThread(enabled = true) {
  return useQuery({
    queryKey: ['support-chat-thread'],
    queryFn: async () => {
      const res = await api.get('/public/support-chat');
      return res.data;
    },
    enabled: enabled && !!getToken(),
    refetchInterval: enabled && getToken() ? 4000 : false,
    staleTime: 2000,
    placeholderData: (prev) => prev,
    // Keep the open thread if a poll fails (auth blip / network).
    retry: (count, err) => {
      const status = err?.response?.status;
      if (status === 403 || status === 401) return false;
      return count < 1;
    },
  });
}

export function useStartSupportChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/public/support-chat/start', payload || {});
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.conversation) {
        qc.setQueryData(['support-chat-thread'], (old) => ({
          success: true,
          ...(old || {}),
          conversation: data.conversation,
          messages: old?.messages || [],
          needs_routing: (data.conversation.routed_to || 'pending') === 'pending',
        }));
      }
      qc.invalidateQueries({ queryKey: ['support-chat-thread'] });
    },
  });
}

export function useRouteSupportChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/support-chat/route', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-chat-thread'] }),
  });
}

export function useSendSupportChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/support-chat/messages', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-chat-thread'] }),
  });
}

export function useUploadSupportChatImage() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/public/support-chat/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}

export function useSearchSupportShops(q, enabled = true) {
  return useQuery({
    queryKey: ['support-shop-search', q],
    queryFn: async () => {
      const res = await api.get('/public/shops', { params: { q, per_page: 8 } });
      return res.data?.data ?? [];
    },
    enabled: enabled && q.trim().length >= 1,
    staleTime: 15000,
  });
}

export function useAdminSupportChatConversations(status = 'open', routedTo = 'all', enabled = true) {
  return useQuery({
    queryKey: ['admin-support-chat', status, routedTo],
    queryFn: async () =>
      (await api.get('/admin/support-chat/conversations', {
        params: { status, routed_to: routedTo },
      })).data,
    enabled,
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function useAdminSupportChatCount(enabled = true) {
  return useQuery({
    queryKey: ['admin-support-chat-count'],
    queryFn: async () => (await api.get('/admin/support-chat/conversations/count')).data.unread_count,
    enabled,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function useAdminSupportChatConversation(id, enabled = true) {
  return useQuery({
    queryKey: ['admin-support-chat-conversation', id],
    queryFn: async () => (await api.get(`/admin/support-chat/conversations/${id}`)).data,
    enabled: enabled && !!id,
    refetchInterval: enabled && id ? 8000 : false,
    staleTime: 3000,
  });
}

export function useAdminReplySupportChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body, image_url }) =>
      (await api.post(`/admin/support-chat/conversations/${id}/messages`, { body, image_url })).data,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-support-chat'] });
      qc.invalidateQueries({ queryKey: ['admin-support-chat-count'] });
      qc.invalidateQueries({ queryKey: ['admin-support-chat-conversation', vars.id] });
    },
  });
}

export function useAdminJoinSupportChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/admin/support-chat/conversations/${id}/join`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin-support-chat'] });
      qc.invalidateQueries({ queryKey: ['admin-support-chat-conversation', id] });
    },
  });
}

export function useAdminUploadSupportChatImage() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('image', file);
      return (await api.post('/admin/support-chat/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    },
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

export function useShopSupportConversation(id, enabled = true) {
  return useQuery({
    queryKey: ['shop-support-conversation', id],
    queryFn: async () => (await api.get(`/shop/support/${id}`)).data,
    enabled: enabled && !!id,
    refetchInterval: enabled && id ? 8000 : false,
  });
}

export function useShopSupportReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/shop/support/reply', payload)).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['shop-support-chats'] });
      qc.invalidateQueries({ queryKey: ['shop-support-conversation', vars.conversation_id] });
    },
  });
}

export function useShopSupportUpload() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('image', file);
      return (await api.post('/shop/support/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    },
  });
}
