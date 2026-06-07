import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const PROVIDER_META = {
  google: {
    label: 'Google',
    className: 'border-black/10 bg-white text-[#111111] hover:bg-black/[0.03] dark:border-white/15 dark:bg-[#1E1E1E] dark:text-white dark:hover:bg-white/5',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="#4285F4" d="M22 12c0-.68-.06-1.34-.17-1.97H12v3.73h5.72a5.18 5.18 0 01-2.25 3.4v2.82H18.3c2.13-1.97 3.36-4.87 3.36-8.08z" />
        <path fill="#34A853" d="M12 23c3.04 0 5.6-1 7.47-2.73l-3.64-2.82c-1.01.68-2.3 1.08-3.83 1.08-2.94 0-5.43-1.98-6.32-4.65H3.34v2.91A10 10 0 0012 23z" />
        <path fill="#FBBC05" d="M5.68 14.28A6.02 6.02 0 015.4 12c0-.79.14-1.55.4-2.28V6.81H3.34A10 10 0 003 12c0 1.61.39 3.13 1.08 4.47l2.6-2.19z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.6 2.09 15.04 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.34 2.59C6.57 7.98 9.06 6 12 6z" />
      </svg>
    ),
  },
  microsoft: {
    label: 'Microsoft',
    className: 'border-black/10 bg-white text-[#111111] hover:bg-black/[0.03] dark:border-white/15 dark:bg-[#1E1E1E] dark:text-white dark:hover:bg-white/5',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <rect x="3" y="3" width="8" height="8" fill="#F25022" />
        <rect x="13" y="3" width="8" height="8" fill="#7FBA00" />
        <rect x="3" y="13" width="8" height="8" fill="#00A4EF" />
        <rect x="13" y="13" width="8" height="8" fill="#FFB900" />
      </svg>
    ),
  },
  apple: {
    label: 'Apple',
    className: 'border-black/10 bg-[#111111] text-white hover:bg-black/90 dark:border-white/15',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M16.7 13.3c-.03-2.1 1.72-3.1 1.8-3.16-1-.14-1.95-.6-2.48-1.22-.56-.64-.88-1.47-.86-2.33 0-1 .27-1.93.79-2.73 1.34-1.95 3.62-2.08 4.49-2.1.19 0 .38.01.57.03-.03.02-.55.32-.55 1.02 0 .73.57 1.05.59 1.07-.51.72-.77 1.63-.77 2.58 0 1.97 1.14 2.96 1.16 2.98-.01.03-1.84 2.65-4.74 2.65-.91 0-1.76-.3-2.48-.86zm-2.2-9.8c.66-.8 1.1-1.92 1.02-3.04-1 .04-2.2.53-2.92 1.33-.61.67-1.15 1.76-1.01 2.8 1.08.08 2.18-.55 2.91-1.09z" />
      </svg>
    ),
  },
};

function useOAuthProviders() {
  return useQuery({
    queryKey: ['oauth-providers'],
    queryFn: async () => (await api.get('/auth/oauth/providers')).data.providers ?? [],
    staleTime: 5 * 60_000,
  });
}

export default function SocialAuthButtons({ mode = 'login' }) {
  const { data: providers = [], isLoading } = useOAuthProviders();
  const verb = mode === 'register' ? 'Sign up' : 'Continue';

  if (isLoading || providers.length === 0) {
    return null;
  }

  const startOAuth = (provider) => {
    window.location.href = `${API_BASE}/auth/oauth/${provider}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-subtle">
        <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-white/15" />
        Or {mode === 'register' ? 'sign up' : 'continue'} with
        <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-white/15" />
      </div>
      <div className="grid gap-3">
        {providers.map((provider) => {
          const meta = PROVIDER_META[provider];
          if (!meta) return null;
          return (
            <button
              key={provider}
              type="button"
              onClick={() => startOAuth(provider)}
              className={`flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border-2 text-sm font-bold transition ${meta.className}`}
            >
              {meta.icon}
              {verb} with {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SocialAuthSetupHint() {
  const { data: providers = [], isLoading } = useOAuthProviders();
  if (isLoading || providers.length > 0) return null;
  return (
    <p className="text-center text-xs text-muted">
      Social sign-in becomes available once Google, Microsoft, or Apple keys are added in backend `.env`.
    </p>
  );
}
