import DashboardSection from '../../components/dashboard/DashboardSection';
import SecurityTab from '../../components/dashboard/settings/SecurityTab';

export default function DashboardSecurityPage() {
  return (
    <DashboardSection title="Security" subtitle="Password, two-factor authentication and active sessions.">
      <SecurityTab />
    </DashboardSection>
  );
}
