import { Outlet } from 'react-router-dom';
import { SearchProvider } from '../../context/SearchProvider';
import Navbar from './Navbar';
import StoreAnnouncementBar from '../store/StoreAnnouncementBar';
import StoreCategoryNav from '../store/StoreCategoryNav';
import BottomNav from './BottomNav';
import Footer from './Footer';
import SearchOverlay from '../search/SearchOverlay';
import ScrollToTop from '../ui/ScrollToTop';
import AdminNotificationWatcher from '../notifications/AdminNotificationWatcher';

import SupportChatWidget from '../support/SupportChatWidget';
import StaffSupportInboxWidget from '../support/StaffSupportInboxWidget';
import PushNotificationPrompt from '../notifications/PushNotificationPrompt';
import { useAuthStore } from '../../store/authStore';
import { canManageSupportChat } from '../../lib/permissions';

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const isSupportStaff = canManageSupportChat(user);

  return (
    <SearchProvider>
      <div className="flex min-h-screen flex-col bg-[#FFF9F3] dark:bg-[#121212]">
        <StoreAnnouncementBar />
        <Navbar />
        <StoreCategoryNav />
        <AdminNotificationWatcher />
        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>
        <Footer />
        <BottomNav />
        <SearchOverlay />
        <ScrollToTop />
        {isSupportStaff ? <StaffSupportInboxWidget /> : <SupportChatWidget />}
        <PushNotificationPrompt />
      </div>
    </SearchProvider>
  );
}
