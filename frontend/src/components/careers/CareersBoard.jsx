import { Link } from 'react-router-dom';

import { usePublicCareers } from '../../hooks/careers';

import { DRIVER_ROLE_NOTE } from '../../lib/careers';



/**

 * @param {'all' | 'operations' | 'driver'} mode

 */

export default function CareersBoard({

  mode = 'operations',

  breadcrumbs,

  title,

  intro,

  disabledMessage,

  emptyMessage,

  showDriverNote = false,

}) {

  const { data, isLoading, isError } = usePublicCareers();



  const allJobs = data?.data ?? [];

  const driverNote = data?.driver_role_note || DRIVER_ROLE_NOTE;



  const jobs = allJobs.filter((job) => {

    if (mode === 'driver') return job.is_driver_role;

    if (mode === 'operations') return !job.is_driver_role;

    return true;

  });



  return (

    <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">

      <nav className="mb-4 text-sm text-muted">{breadcrumbs}</nav>



      <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">{title}</h1>

      <p className="mt-2 text-muted">{intro}</p>



      {showDriverNote && (

        <p className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm font-medium text-[#7c4a03] dark:text-brand-gold">

          {driverNote}

        </p>

      )}



      {disabledMessage ? (

        <p className="mt-8 rounded-xl border border-black/8 bg-white p-5 text-sm text-muted dark:border-white/10 dark:bg-[#1E1E1E]">

          {disabledMessage}

        </p>

      ) : isLoading ? (

        <p className="mt-8 text-sm text-muted">Loading open roles…</p>

      ) : isError ? (

        <p className="mt-8 text-sm text-muted">Applications are not available right now.</p>

      ) : jobs.length === 0 ? (

        <p className="mt-8 rounded-xl border border-black/8 bg-white p-5 text-sm text-muted dark:border-white/10 dark:bg-[#1E1E1E]">

          {emptyMessage}

        </p>

      ) : (

        <ul className="mt-8 space-y-4">

          {jobs.map((job) => (

            <li key={job.id}>

              <Link

                to={`/careers/apply/${job.id}`}

                className="block rounded-2xl border border-black/8 bg-white p-5 shadow-sm transition hover:border-brand-green/40 dark:border-white/10 dark:bg-[#1E1E1E] dark:hover:border-brand-green/40"

              >

                <div className="flex flex-wrap items-start justify-between gap-2">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-wide text-brand-green">{job.job_type_label}</p>

                    <h2 className="text-lg font-extrabold">{job.title}</h2>

                    <p className="text-sm text-muted">{job.city}</p>

                  </div>

                  <span className="btn-primary px-4 py-2 text-sm">Apply →</span>

                </div>

                {job.is_driver_role && (

                  <p className="mt-3 rounded-lg bg-brand-gold/10 px-3 py-2 text-xs font-medium text-[#7c4a03] dark:text-brand-gold">

                    {driverNote}

                  </p>

                )}

                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">

                  {job.description}

                </p>

                {(job.fields?.length ?? 0) > 0 && (

                  <p className="mt-3 text-xs text-muted">

                    Application includes {job.fields.length} field{job.fields.length === 1 ? '' : 's'}

                    {job.fields.some((f) => f.field_type === 'file') ? ' · file uploads accepted' : ''}

                  </p>

                )}

              </Link>

            </li>

          ))}

        </ul>

      )}

    </div>

  );

}



export function CareersBreadcrumb({ current, parent }) {

  return (

    <>

      <Link to="/" className="hover:text-brand-green">Home</Link>

      <span className="mx-2">/</span>

      {parent ? (

        <>

          <Link to={parent.to} className="hover:text-brand-green">{parent.label}</Link>

          <span className="mx-2">/</span>

        </>

      ) : null}

      <span>{current}</span>

    </>

  );

}


