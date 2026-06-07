import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCompanyStore } from '../../store/companyStore';

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

  useEffect(() => {
    if (!analytics?.enabled || !analytics?.measurement_id) {
      return;
    }
    ensureGtag(analytics.measurement_id);
  }, [analytics?.enabled, analytics?.measurement_id]);

  useEffect(() => {
    if (!analytics?.enabled || !analytics?.measurement_id || typeof window.gtag !== 'function') {
      return;
    }
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location.pathname, location.search, analytics?.enabled, analytics?.measurement_id]);

  return null;
}
