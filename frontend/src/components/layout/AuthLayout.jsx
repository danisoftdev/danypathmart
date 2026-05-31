import { Outlet, Link } from 'react-router-dom';
import { Logo } from './Navbar';
import DarkModeToggle from './DarkModeToggle';

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <DarkModeToggle />
      </div>
      <Link to="/" className="mb-6">
        <Logo className="text-2xl" />
      </Link>
      <Outlet />
      <p className="mt-8 text-xs text-subtle">
        Developed &amp; Owned by{' '}
        <a
          href="https://danysoftdev.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-green hover:underline"
        >
          danysoftdev.com
        </a>
      </p>
    </div>
  );
}
