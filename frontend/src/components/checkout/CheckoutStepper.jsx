const ADDRESS_STEPS = [
  { label: 'Address', desc: 'Where to deliver' },
  { label: 'Summary', desc: 'Review order' },
  { label: 'Payment', desc: 'Pay securely' },
];

const PICKUP_STEPS = [
  { label: 'Pickup point', desc: 'Where to collect' },
  { label: 'Summary', desc: 'Review order' },
  { label: 'Payment', desc: 'Pay securely' },
];

export default function CheckoutStepper({ current, pickupMode = false }) {
  const STEPS = pickupMode ? PICKUP_STEPS : ADDRESS_STEPS;
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>Step {current} of {STEPS.length}</span>
        <span className="text-brand-green">{STEPS[current - 1]?.label}</span>
      </div>

      {/* Mobile: compact progress bar */}
      <div className="mb-4 flex gap-1.5 sm:hidden">
        {STEPS.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 flex-1 rounded-full ${idx < current ? 'bg-brand-green' : 'bg-black/10 dark:bg-white/10'}`}
          />
        ))}
      </div>

      {/* Desktop: full stepper */}
      <ol className="hidden items-center justify-between sm:flex">
        {STEPS.map((step, idx) => {
          const stepNo = idx + 1;
          const active = stepNo === current;
          const done = stepNo < current;
          return (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition',
                    done || active
                      ? 'bg-brand-green text-white shadow-md shadow-brand-green/20'
                      : 'bg-black/8 text-muted dark:bg-white/10',
                  ].join(' ')}
                >
                  {done ? '✓' : stepNo}
                </span>
                <div className="min-w-0 hidden md:block">
                  <p className={`text-sm font-bold ${active ? 'text-brand-green' : done ? 'text-[#111111] dark:text-white' : 'text-muted'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-subtle">{step.desc}</p>
                </div>
              </div>
              {stepNo < STEPS.length && (
                <div
                  className={[
                    'mx-3 h-0.5 flex-1 rounded-full',
                    done ? 'bg-brand-green' : 'bg-black/10 dark:bg-white/10',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
