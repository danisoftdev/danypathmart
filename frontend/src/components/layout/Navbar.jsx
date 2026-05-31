import { useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../search/SearchBar';
import DarkModeToggle from './DarkModeToggle';
import { CartIcon, UserIcon, MenuIcon, CloseIcon } from '../icons';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';

export function Logo({ className = 'text-xl' }) {
  return (
    <Link to="/" className={`flex items-center font-extrabold ${className}`}>
      <span className="text-brand-green">DanyPathMart</span>
      <span className="ml-0.5 text-brand-gold">.</span>
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const items = useCartStore((s) => s.items);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const accountTo = isAuthenticated ? '/dashboard' : '/login';

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-brand-light/95 backdrop-blur dark:border-white/10 dark:bg-brand-dark/95">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Logo />

        <div className="hidden flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative rounded-full p-2 transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-bold text-black">
                {count}
              </span>
            )}
          </Link>

          <Link
            to={accountTo}
            aria-label="Account"
            className="rounded-full p-2 transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <UserIcon />
          </Link>

          <DarkModeToggle />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="rounded-full p-2 transition hover:bg-black/5 md:hidden dark:hover:bg-white/10"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-black/5 px-4 py-3 md:hidden dark:border-white/10">
          <SearchBar onNavigate={() => setOpen(false)} />
          <nav className="mt-3 flex flex-col gap-2 text-sm font-medium">
            <Link to="/shop" onClick={() => setOpen(false)} className="py-1">Shop</Link>
            <Link to="/cart" onClick={() => setOpen(false)} className="py-1">Cart</Link>
            <Link to={accountTo} onClick={() => setOpen(false)} className="py-1">Account</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
