import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getToken } from '../lib/api';

const GUEST_TOKEN_KEY = 'dpm_support_guest_token';
const GUEST_PROFILE_KEY = 'dpm_support_guest_profile';

export function getSupportGuestToken() {
  let token = localStorage.getItem(GUEST_TOKEN_KEY);
  if (!token) {
    token = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : `guest${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  }
  return token;
}

export function getSupportGuestProfile() {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSupportGuestProfile(profile) {
  localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
}

function guestHeaders() {
  return { 'X-Support-Guest-Token': getSupportGuestToken() };
}

function supportHeaders() {
  const headers = { ...guestHeaders() };
  return headers;
}

export function useSupportChatThread(enabled = true) {
  return useQuery({
    queryKey: ['support-chat-thread'],
    queryFn: async () => {
      const res = await api.get('/public/support-chat', {
        headers: supportHeaders(),
      });
      return res.data;
    },
    enabled,
    refetchInterval: enabled ? 8000 : false,
    staleTime: 3000,
  });
}

export function useStartSupportChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const isLoggedIn = !!getToken();
      const res = await api.post('/public/support-chat/start', payload || {}, {
        headers: isLoggedIn ? {} : supportHeaders(),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-chat-thread'] }),
  });
}

export function useSendSupportChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/support-chat/messages', payload, {
      headers: supportHeaders(),
    })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-chat-thread'] }),
  });
}

export function useUploadSupportChatImage() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/public/support-chat/upload', form, {
        headers: {
          ...supportHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    },
  });
}

export function useAdminSupportChatConversations(status = 'open', enabled = true) {
  return useQuery({
    queryKey: ['admin-support-chat', status],
    queryFn: async () => (await api.get('/admin/support-chat/conversations', { params: { status } })).data,
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
