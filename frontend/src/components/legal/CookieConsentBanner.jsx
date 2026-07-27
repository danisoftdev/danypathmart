import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getCookieConsent, setCookieConsent } from '../../lib/cookieConsent';

/**
 * Site-wide cookie notice. Shown until the visitor accepts (or chooses essential-only).
 * Preference is stored in localStorage so it does not reappear every visit.
 */
export default function CookieConsentBanner() {
  const [choice, setChoice] = useState(() => getCookieConsent());

  if (choice) return null;

  const accept = (value) => {
    setCookieConsent(value);
    setChoice(value);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-[#1A1A1A]/95"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white">We use cookies</p>
          <p className="mt-1 text-xs leading-relaxed text-muted md:text-sm">
            We use essential cookies to keep you signed in, remember your cart, and run the site
            securely. See our{' '}
            <Link to="/policies/cookies" className="font-bold text-brand-green underline-offset-2 hover:underline">
              Cookies policy
            </Link>{' '}
            for details.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => accept('essential')}
            className="min-h-[40px] rounded-lg border border-black/15 px-4 text-xs font-bold text-[#111111] transition hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => accept('accepted')}
            className="btn-primary min-h-[40px] px-5 text-xs"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
