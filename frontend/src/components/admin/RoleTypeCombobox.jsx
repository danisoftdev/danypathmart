import { useMemo, useRef, useState } from 'react';

/**
 * Combobox: type freely or pick from existing role types.
 * Saves the display label; backend resolves/creates catalog entry on save.
 */
export default function RoleTypeCombobox({
  value,
  onChange,
  roleTypes = [],
  disabled = false,
  onRoleSlugChange,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return roleTypes;
    return roleTypes.filter(
      (r) => r.label.toLowerCase().includes(q) || r.slug.includes(q.replace(/\s+/g, '_'))
    );
  }, [value, roleTypes]);

  const pick = (role) => {
    onChange(role.label);
    onRoleSlugChange?.(role.slug);
    setOpen(false);
  };

  const showDropdown = open && !disabled && filtered.length > 0;

  return (
    <div className="relative" ref={wrapRef}>
      <label className="block text-sm">
        <span className="mb-1 block font-bold">Role type</span>
        <input
          className="input-field w-full"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            onRoleSlugChange?.(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Type or select a role…"
          required
          autoComplete="off"
          list={undefined}
        />
        <p className="mt-1 text-xs text-muted">
          Pick from the list or type a new role — new types are saved automatically.
        </p>
      </label>

      {showDropdown && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#1E1E1E]">
          {filtered.map((role) => (
            <li key={role.slug}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-green/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(role)}
              >
                {role.label}
                {role.is_driver ? (
                  <span className="ml-2 text-[10px] font-bold uppercase text-brand-gold">Driver page</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function slugifyRoleType(input) {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'role';
}

export function templateSlugForRole(label, roleTypes) {
  const q = (label || '').trim().toLowerCase();
  if (!q) return null;
  const match = roleTypes.find(
    (r) => r.label.toLowerCase() === q || r.slug === slugifyRoleType(label)
  );
  return match?.slug || slugifyRoleType(label);
}
