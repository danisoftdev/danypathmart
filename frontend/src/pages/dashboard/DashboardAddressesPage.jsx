import DashboardSection from '../../components/dashboard/DashboardSection';
import AddressesTab from '../../components/dashboard/settings/AddressesTab';

export default function DashboardAddressesPage() {
  return (
    <DashboardSection title="Saved addresses" subtitle="Manage delivery locations for faster checkout.">
      <AddressesTab />
    </DashboardSection>
  );
}
