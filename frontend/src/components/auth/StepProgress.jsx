/** @param {{ step: number, total: number, labels?: string[] }} props */
export default function StepProgress({ step, total, labels = [] }) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
        <span>Step {step} of {total}</span>
        {labels[step - 1] && <span className="text-brand-green">{labels[step - 1]}</span>}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${
              i < step ? 'bg-brand-green' : 'bg-[#E5E7EB] dark:bg-[#2A2A2A]'
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
