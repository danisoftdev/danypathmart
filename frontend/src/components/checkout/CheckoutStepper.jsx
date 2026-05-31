const STEPS = ['Address', 'Summary', 'Payment'];

export default function CheckoutStepper({ current }) {
  return (
    <ol className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((label, idx) => {
        const stepNo = idx + 1;
        const active = stepNo === current;
        const done = stepNo < current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition',
                  active || done
                    ? 'bg-brand-green text-white'
                    : 'bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50',
                ].join(' ')}
              >
                {done ? '\u2713' : stepNo}
              </span>
              <span
                className={[
                  'text-sm font-medium',
                  active ? 'text-brand-green' : 'text-black/50 dark:text-white/50',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {stepNo < STEPS.length && (
              <span
                className={[
                  'h-0.5 w-6 sm:w-12',
                  done ? 'bg-brand-green' : 'bg-black/10 dark:bg-white/10',
                ].join(' ')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
