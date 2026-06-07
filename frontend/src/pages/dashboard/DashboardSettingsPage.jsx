import DashboardSection from '../../components/dashboard/DashboardSection';
import ProfileTab from '../../components/dashboard/settings/ProfileTab';

export default function DashboardSettingsPage() {
  return (
    <DashboardSection title="Profile settings" subtitle="Update your name, photo and email.">
      <ProfileTab />
    </DashboardSection>
  );
}
