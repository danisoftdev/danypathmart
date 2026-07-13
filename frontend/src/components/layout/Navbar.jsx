import { Link } from 'react-router-dom';
import SearchBar from '../search/SearchBar';
import NotificationsBell from './NotificationsBell';
import DarkModeToggle from './DarkModeToggle';
import SiteLogo from '../brand/SiteLogo';
import UserAvatar from '../brand/UserAvatar';
import { CartIcon } from '../icons';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { accountPathForUser, isAdminUser } from '../../lib/permissions';
import { useWishlistIds } from '../../hooks/wishlist';

/** @deprecated Use SiteLogo — kept for any legacy imports */
export function Logo(props) {
  return <SiteLogo size="h-10 w-10" {...props} />;
}

export default function Navbar() {
  const items = useCartStore((s) => s.items);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const accountTo = accountPathForUser(isAuthenticated ? user : null);
  const { ids: wishlistIds } = useWishlistIds();
  const wishlistCount = isAuthenticated && (user?.role === 'customer' || user?.has_shop) ? wishlistIds.length : 0;
  const wishlistTo = isAuthenticated && (user?.role === 'customer' || user?.has_shop) ? '/dashboard/wishlist' : '/login';

  return (
    <header className="sticky top-0 z-40 border-b border-black/8 bg-[#FFF9F3]/95 backdrop-blur-md dark:border-white/10 dark:bg-[#121212]/95">
      {/* Desktop — logo | centered search | actions (Jumia / Temu style) */}
      <div className="mx-auto hidden max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid lg:gap-6">
        <div className="shrink-0">
          <SiteLogo size="h-10 w-10" />
        </div>

        <div className="flex min-w-0 justify-center px-2 lg:px-8">
          <div className="w-full max-w-xl lg:max-w-2xl">
            <SearchBar size="lg" />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1">
          <DarkModeToggle />
          <NotificationsBell />

          {!isAdminUser(user) && (
            <Link
              to={wishlistTo}
              aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ''}`}
              className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-lg transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              ♥
              {wishlistCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>
          )}

          <Link
            to="/cart"
            aria-label={`Cart${count ? `, ${count} items` : ''}`}
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-bold text-black">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>

          <Link
            to={accountTo}
            aria-label="Account"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            {isAuthenticated ? (
              <UserAvatar user={user} className="h-9 w-9" />
            ) : (
              <UserAvatar user={null} className="h-9 w-9" />
            )}
          </Link>
        </div>
      </div>

      {/* Mobile */}
      <div className="mx-auto max-w-7xl px-4 py-2.5 md:hidden">
        <div className="flex items-center justify-between">
          <SiteLogo size="h-9 w-9" />
          <div className="flex items-center gap-1">
          <DarkModeToggle />
          <Link
            to="/cart"
            aria-label={`Cart${count ? `, ${count} items` : ''}`}
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
                {count}
              </span>
            )}
          </Link>
          {!isAdminUser(user) && (
            <Link
              to={wishlistTo}
              aria-label="Wishlist"
              className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-lg"
            >
              ♥
              {wishlistCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>
          )}
          <NotificationsBell />
          </div>
        </div>
        <div className="mt-2.5 flex justify-center pb-1">
          <div className="w-full max-w-lg">
            <SearchBar size="md" />
          </div>
        </div>
      </div>
    </header>
  );
}
