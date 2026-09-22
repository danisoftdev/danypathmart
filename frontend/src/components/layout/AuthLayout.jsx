import { Outlet } from 'react-router-dom';
import SiteLogo from '../brand/SiteLogo';
import DarkModeToggle from './DarkModeToggle';
import DocumentMeta from '../seo/DocumentMeta';

export default function AuthLayout() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#FFF9F3] via-white to-[#FFF9F3] px-4 py-8 dark:from-[#121212] dark:via-[#1a1a1a] dark:to-[#121212] sm:py-12">
      <DocumentMeta />
      <div className="absolute right-4 top-4 z-10">
        <DarkModeToggle />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col items-center justify-center">
        <SiteLogo size="h-24 w-24 sm:h-28 sm:w-28" className="mb-8" />
        <Outlet />
      </div>
    </div>
  );
}
