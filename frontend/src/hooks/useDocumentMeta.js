import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePageMeta } from '../lib/pageMeta';
import { useCompanyStore } from '../store/companyStore';

function upsertMeta(name, content, attribute = 'name') {
  if (!content) return null;
  let el = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

function removeMeta(name, attribute = 'name') {
  document.querySelector(`meta[${attribute}="${name}"]`)?.remove();
}

export default function useDocumentMeta(override) {
  const { pathname } = useLocation();
  const company = useCompanyStore((s) => s.company);

  useEffect(() => {
    const resolved = resolvePageMeta(pathname, company);
    const meta = { ...resolved, ...override };

    const prevTitle = document.title;
    document.title = meta.title || company.company_name || 'DanyPathMart';

    const prevDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
    const descEl = meta.description
      ? upsertMeta('description', meta.description)
      : null;
    if (!meta.description) removeMeta('description');

    const prevRobots = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
    if (meta.robots) {
      upsertMeta('robots', meta.robots);
    } else {
      removeMeta('robots');
    }

    return () => {
      document.title = prevTitle;
      if (descEl && prevDescription) descEl.setAttribute('content', prevDescription);
      else if (!prevDescription) removeMeta('description');
      if (prevRobots) upsertMeta('robots', prevRobots);
      else removeMeta('robots');
    };
  }, [pathname, company, override]);
}
