import { Link } from 'react-router-dom';
import { SITE_LOGO_SRC } from '../../lib/brand';

const LOGO_FRAME =
  'flex items-center justify-center overflow-hidden rounded-full border-2 border-brand-green/50 bg-white p-1 shadow-sm ring-2 ring-brand-gold/25 dark:bg-white';

export default function SiteLogo({
  className = '',
  size = 'h-10 w-10',
  to = '/',
}) {
  const content = (
    <span className={`${LOGO_FRAME} ${size}`}>
      <img
        src={SITE_LOGO_SRC}
        alt="DanyPathMart"
        className="h-full w-full object-contain"
      />
    </span>
  );

  if (to == null || to === false) {
    return (
      <span className={`inline-flex shrink-0 items-center ${className}`} aria-label="DanyPathMart home">
        {content}
      </span>
    );
  }

  return (
    <Link
      to={to}
      className={`inline-flex shrink-0 items-center ${className}`}
      aria-label="DanyPathMart home"
    >
      {content}
    </Link>
  );
}

export { LOGO_FRAME };
