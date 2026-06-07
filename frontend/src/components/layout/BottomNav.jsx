import { NavLink } from 'react-router-dom';
import { HomeIcon, GridIcon, SearchIcon, CartIcon, UserIcon } from '../icons';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { accountPathForUser } from '../../lib/permissions';
import { useSearchOverlay } from '../../hooks/useSearchOverlay';

const tabs = [
  { key: 'home', to: '/', label: 'Home', icon: HomeIcon, end: true },
  { key: 'categories', to: '/shop', label: 'Categories', icon: GridIcon, end: false },
  { key: 'search', label: 'Search', icon: SearchIcon, action: 'search' },
  { key: 'cart', to: '/cart', label: 'Cart', icon: CartIcon, end: false },
  { key: 'account', label: 'Account', icon: UserIcon, end: false },
];

export default function BottomNav() {
  const items = useCartStore((s) => s.items);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cartCount = items.reduce((sum, i) => sum + i.qty, 0);
  const { openSearch } = useSearchOverlay();
  const accountTo = accountPathForUser(isAuthenticated ? user : null);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/8 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(17,17,17,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#1E1E1E]/95 md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSearch = tab.action === 'search';

          if (isSearch) {
            return (
              <li key={tab.key} className="flex-1">
                <button
                  type="button"
                  onClick={openSearch}
                  className="flex w-full flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium text-black/60 dark:text-white/60"
                >
                  <Icon className="h-6 w-6" />
                  {tab.label}
                </button>
              </li>
            );
          }

          const to = tab.key === 'account' ? accountTo : tab.to;

          return (
            <li key={tab.key} className="flex-1">
              <NavLink
                to={to}
                end={tab.end}
                className={({ isActive }) =>
                  [
                    'relative flex w-full flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition',
                    isActive ? 'text-brand-green' : 'text-black/60 dark:text-white/60',
                  ].join(' ')
                }
              >
                <Icon className="h-6 w-6" />
                {tab.label}
                {tab.key === 'cart' && cartCount > 0 && (
                  <span className="absolute right-[calc(50%-22px)] top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-black">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
