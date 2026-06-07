import { SITE_LOGO_SRC } from './brand';
import { resolveImageUrl } from './currency';

/** Product/upload paths on the API; brand assets stay on the Vite public folder. */
export function resolveProductImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/brand/')) return url;
  return resolveImageUrl(url);
}

export { SITE_LOGO_SRC as PRODUCT_FALLBACK_IMAGE };
