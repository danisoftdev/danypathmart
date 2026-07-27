import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCompanyStore } from '../../store/companyStore';
import { COOKIE_CONSENT_KEY, getCookieConsent, hasAnalyticsConsent } from '../../lib/cookieConsent';

function ensureGtag(measurementId) {
  if (typeof window.gtag === 'function') {
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args) {
    window.dataLayer.push(args);
  };
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
}

export default function AnalyticsLoader() {
  const location = useLocation();
  const analytics = useCompanyStore((s) => s.company?.analytics);
  const [consent, setConsent] = useState(() => getCookieConsent());

  useEffect(() => {
    const onConsent = () => setConsent(getCookieConsent());
    window.addEventListener('dpm:cookie-consent', onConsent);
    const onStorage = (e) => {
      if (e.key === COOKIE_CONSENT_KEY) onConsent();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('dpm:cookie-consent', onConsent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const allowed = hasAnalyticsConsent(consent);

  useEffect(() => {
    if (!allowed || !analytics?.enabled || !analytics?.measurement_id) {
      return;
    }
    ensureGtag(analytics.measurement_id);
  }, [allowed, analytics?.enabled, analytics?.measurement_id]);

  useEffect(() => {
    if (!allowed || !analytics?.enabled || !analytics?.measurement_id || typeof window.gtag !== 'function') {
      return;
    }
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [allowed, location.pathname, location.search, analytics?.enabled, analytics?.measurement_id]);

  return null;
}
