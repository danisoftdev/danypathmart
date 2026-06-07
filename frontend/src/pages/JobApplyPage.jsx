import { Link, useParams } from 'react-router-dom';
import { usePlatformFeatures } from '../hooks/checkout';
import { useApplyForJob, usePublicJob } from '../hooks/careers';
import DynamicApplicationForm from '../components/careers/DynamicApplicationForm';
import { CareersBreadcrumb } from '../components/careers/CareersBoard';
import { DRIVER_ROLE_NOTE } from '../lib/careers';

export default function JobApplyPage() {
  const { jobId } = useParams();
  const id = Number(jobId);
  const { careersEnabled, isLoading: flagsLoading } = usePlatformFeatures();
  const { data, isLoading, isError } = usePublicJob(id, careersEnabled);
  const apply = useApplyForJob();

  const job = data?.job;
  const driverNote = data?.driver_role_note || DRIVER_ROLE_NOTE;
  const backTo = job?.is_driver_role ? '/careers/drivers' : '/careers';
  const backLabel = job?.is_driver_role ? 'Delivery drivers' : 'Careers';

  if (!flagsLoading && !careersEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">
        <p className="text-sm text-muted">Applications are not open right now.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-brand-green hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">
      <nav className="mb-4 text-sm text-muted">
        <CareersBreadcrumb
          current="Apply"
          parent={{ to: backTo, label: backLabel }}
        />
      </nav>

      {isLoading || flagsLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : isError || !job ? (
        <div>
          <p className="text-sm text-muted">This job is no longer available.</p>
          <Link to={backTo} className="mt-4 inline-block text-sm font-bold text-brand-green hover:underline">
            ← Back to {backLabel.toLowerCase()}
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">{job.job_type_label}</p>
          <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">{job.title}</h1>
          <p className="mt-1 text-sm text-muted">{job.city}</p>

          {job.is_driver_role && (
            <p className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm font-medium text-[#7c4a03] dark:text-brand-gold">
              {driverNote}
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">About this role</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{job.description}</p>
          </div>

          <div className="mt-8">
            <DynamicApplicationForm
              job={job}
              onSubmit={(fd) => apply.mutateAsync(fd)}
              submitting={apply.isPending}
            />
          </div>

          <Link to={backTo} className="mt-6 inline-block text-sm font-bold text-brand-green hover:underline">
            ← Back to all roles
          </Link>
        </>
      )}
    </div>
  );
}
