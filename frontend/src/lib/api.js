import axios from 'axios';

const TOKEN_KEY = 'dpm_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh so concurrent 401s share one refresh call.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => {
        const token = res.data?.access_token;
        if (token) setToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthRoute =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh');
    // Business "please sign in" responses — not an expired JWT session.
    const isSoftAuth =
      code === 'account_required' ||
      code === 'forbidden' ||
      (typeof original?.url === 'string' && original.url.includes('/public/support-chat/start'));

    if (status === 401 && !original?._retry && !isAuthRoute && !isSoftAuth) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.dispatchEvent(new CustomEvent('dpm:auth-expired'));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
