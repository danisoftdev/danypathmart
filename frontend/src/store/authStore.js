import { create } from 'zustand';
import api, { setToken, clearToken, getToken } from '../lib/api';
import { isDevAdminBypassEnabled } from '../lib/devAdmin';

function readStored2faTemp() {
  try {
    return sessionStorage.getItem('dpm_2fa_temp') || null;
  } catch {
    return null;
  }
}

const stored2faTemp = readStored2faTemp();

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: !!getToken(),
  requires2FA: !!stored2faTemp,
  tempToken: stored2faTemp,
  loading: false,

  /**
   * Password login. Returns { requires2FA } so the caller can route to the
   * 2FA screen instead of the dashboard.
   */
  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.requires_2fa) {
      // Drop any leftover JWT so the 2FA step is not treated as an active session.
      clearToken();
      try {
        sessionStorage.setItem('dpm_2fa_temp', data.temp_token);
      } catch {
        /* ignore */
      }
      set({
        user: null,
        isAuthenticated: false,
        requires2FA: true,
        tempToken: data.temp_token,
      });
      return { requires2FA: true };
    }
    try {
      sessionStorage.removeItem('dpm_2fa_temp');
    } catch {
      /* ignore */
    }
    get().setSession(data);
    if (data.user?.role === 'customer') {
      const { syncWishlistToServer } = await import('../lib/wishlistStorage');
      await syncWishlistToServer();
    }
    return { requires2FA: false };
  },

  /** Complete OAuth redirect flow with one-time ticket. */
  async oauthExchange(ticket) {
    const { data } = await api.post('/auth/oauth/exchange', { ticket });
    get().setSession(data);
    if (data.user?.role === 'customer') {
      const { syncWishlistToServer } = await import('../lib/wishlistStorage');
      await syncWishlistToServer();
    }
    return data.user;
  },

  /** Persist a successful auth response (JWT + user). */
  setSession(data) {
    setToken(data.access_token);
    try {
      sessionStorage.removeItem('dpm_2fa_temp');
    } catch {
      /* ignore */
    }
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

  /** Dev only — issue an admin JWT without password (backend must allow it). */
  async devAdminLogin() {
    const { data } = await api.post('/auth/dev-admin');
    get().setSession(data);
    return data.user;
  },

  /** Load the current user if a token is present (called on app boot). */
  async loadMe() {
    if (!getToken()) {
      if (isDevAdminBypassEnabled()) {
        try {
          return await get().devAdminLogin();
        } catch {
          set({ user: null, isAuthenticated: false });
          return null;
        }
      }
      set({ user: null, isAuthenticated: false });
      return null;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isAuthenticated: true });
      if (data.user?.role === 'customer') {
        const { syncWishlistToServer } = await import('../lib/wishlistStorage');
        await syncWishlistToServer();
      }
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
    try {
      sessionStorage.removeItem('dpm_2fa_temp');
    } catch {
      /* ignore */
    }
    set({ user: null, isAuthenticated: false, requires2FA: false, tempToken: null });
  },
}));
