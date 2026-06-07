export default function AdminFilterBar({ children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/8 bg-white p-2 dark:border-white/10 dark:bg-[#1E1E1E]">
      {children}
    </div>
  );
}

export function AdminFilterSelect({ value, onChange, children, label }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      {label && <span className="hidden font-semibold text-muted sm:inline">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="admin-filter-select">
        {children}
      </select>
    </label>
  );
}
