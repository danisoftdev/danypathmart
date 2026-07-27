export const COOKIE_CONSENT_KEY = 'dpm_cookie_consent';

/** @returns {string|null} */
export function getCookieConsent() {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
}

/** @param {string} value */
export function setCookieConsent(value) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* private mode / quota */
  }
  try {
    window.dispatchEvent(new CustomEvent('dpm:cookie-consent', { detail: value }));
  } catch {
    /* ignore */
  }
}

/** Analytics (e.g. Google) only after full Accept — not essential-only. */
export function hasAnalyticsConsent(consent = getCookieConsent()) {
  return consent === 'accepted';
}
