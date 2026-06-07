import { Link } from 'react-router-dom';
import { usePlatformFeatures } from '../hooks/checkout';
import CareersBoard, { CareersBreadcrumb } from '../components/careers/CareersBoard';

export default function CareersPage() {
  const { careersEnabled, isLoading: flagsLoading } = usePlatformFeatures();

  const disabledMessage =
    !flagsLoading && !careersEnabled
      ? 'We are not hiring through the careers page right now. Check back soon or contact us with general interest.'
      : null;

  return (
    <>
      <CareersBoard
        mode="operations"
        breadcrumbs={<CareersBreadcrumb current="Careers" />}
        title="Careers"
        intro="Join our warehouse and pickup station teams. For delivery driver roles, see our driver sign-up page."
        disabledMessage={disabledMessage}
        emptyMessage="No open operations roles at the moment. Check back soon or see delivery driver openings."
        showDriverNote={false}
      />
      {!disabledMessage && (
        <p className="-mt-16 mx-auto max-w-3xl px-4 pb-24 text-sm text-muted md:-mt-12">
          Interested in driving hub-to-station runs?{' '}
          <Link to="/careers/drivers" className="font-bold text-brand-green hover:underline">
            Delivery driver sign-up →
          </Link>
        </p>
      )}
    </>
  );
}
