import { Link } from 'react-router-dom';
import { usePlatformFeatures } from '../hooks/checkout';
import CareersBoard, { CareersBreadcrumb } from '../components/careers/CareersBoard';

export default function DriverSignupPage() {
  const { careersEnabled, driverHiringEnabled, isLoading: flagsLoading } = usePlatformFeatures();

  let disabledMessage = null;
  if (!flagsLoading) {
    if (!careersEnabled) {
      disabledMessage =
        'Driver sign-up is not open right now. Enable careers in admin settings or check back soon.';
    } else if (!driverHiringEnabled) {
      disabledMessage =
        'We are not accepting delivery driver applications at the moment. Check back soon or view other careers.';
    }
  }

  return (
    <>
      <CareersBoard
        mode="driver"
        breadcrumbs={
          <CareersBreadcrumb current="Delivery drivers" parent={{ to: '/careers', label: 'Careers' }} />
        }
        title="Delivery driver sign-up"
        intro="Move sealed orders from our central hub to pickup stations. Hub ↔ station runs only — not home-delivery riders and no cash handling."
        disabledMessage={disabledMessage}
        emptyMessage="No driver openings listed right now. You can still contact us — we may keep your details on file."
        showDriverNote
      />
      {!disabledMessage && (
        <p className="-mt-16 mx-auto max-w-3xl px-4 pb-24 text-sm text-muted md:-mt-12">
          Warehouse or station roles?{' '}
          <Link to="/careers" className="font-bold text-brand-green hover:underline">
            View all careers →
          </Link>
        </p>
      )}
    </>
  );
}
