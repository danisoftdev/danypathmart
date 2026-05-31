import { create } from 'zustand';
import api, { setToken, clearToken, getToken } from '../lib/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: !!getToken(),
  requires2FA: false,
  tempToken: null,
  loading: false,

  /**
   * Password login. Returns { requires2FA } so the caller can route to the
   * 2FA screen instead of the dashboard.
   */
  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.requires_2fa) {
      set({ requires2FA: true, tempToken: data.temp_token });
      return { requires2FA: true };
    }
    get().setSession(data);
    return { requires2FA: false };
  },

  /** Persist a successful auth response (JWT + user). */
  setSession(data) {
    setToken(data.access_token);
    set({
      user: data.user,
      isAuthenticated: true,
      requires2FA: false,
      tempToken: null,
    });
  },

  setUser(user) {
    set({ user });
  },

  /** Load the current user if a token is present (called on app boot). */
  async loadMe() {
    if (!getToken()) {
      set({ user: null, isAuthenticated: false });
      return null;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isAuthenticated: true });
      return data.user;
    } catch {
      get().reset();
      return null;
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore network errors on logout */
    }
    get().reset();
  },

  reset() {
    clearToken();
    set({ user: null, isAuthenticated: false, requires2FA: false, tempToken: null });
  },
}));
