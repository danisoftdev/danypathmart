function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition disabled:opacity-50',
        checked ? 'bg-brand-green' : 'bg-black/15 dark:bg-white/20',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}

export default function PermissionGrid({
  permissions,
  onChange,
  groups,
  labels,
  disabled = false,
  compact = false,
}) {
  const toggle = (key) => (val) => onChange({ ...permissions, [key]: val });

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-gold">{group.title}</p>
          <div className="space-y-2">
            {group.keys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 dark:border-white/10"
              >
                <span className="text-sm">{labels[key] || key}</span>
                <Toggle checked={!!permissions[key]} onChange={toggle(key)} disabled={disabled} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { Toggle };
