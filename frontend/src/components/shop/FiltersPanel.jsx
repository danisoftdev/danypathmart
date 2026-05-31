const PRICE_MAX = 1000;

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? 'bg-brand-green' : 'bg-[#E5E7EB] dark:bg-[#2A2A2A]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'left-4' : 'left-0.5'
          }`}
        />
      </span>
    </label>
  );
}

export default function FiltersPanel({ categories, filters, update, onClear }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-gold">Categories</h3>
        <div className="space-y-1">
          {categories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
              <input
                type="checkbox"
                checked={filters.category === c.slug}
                onChange={() => update({ category: filters.category === c.slug ? '' : c.slug })}
                className="h-4 w-4 accent-brand-green"
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-gold">Price</h3>
        <input
          type="range"
          min="0"
          max={PRICE_MAX}
          step="10"
          value={filters.price_max || PRICE_MAX}
          onChange={(e) => update({ price_max: Number(e.target.value) })}
          className="w-full accent-brand-green"
        />
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.price_min ?? ''}
            onChange={(e) => update({ price_min: e.target.value })}
            className="modal-input px-2 py-1"
          />
          <span className="text-subtle">-</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.price_max ?? ''}
            onChange={(e) => update({ price_max: e.target.value })}
            className="modal-input px-2 py-1"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-gold">Availability</h3>
        <Toggle
          label="In stock only"
          checked={filters.in_stock === '1'}
          onChange={() => update({ in_stock: filters.in_stock === '1' ? '' : '1' })}
        />
        <Toggle
          label="Pre-order only"
          checked={filters.is_preorder === '1'}
          onChange={() => update({ is_preorder: filters.is_preorder === '1' ? '' : '1' })}
        />
      </div>

      <button
        type="button"
        onClick={onClear}
        className="w-full rounded-lg border border-brand-green px-3 py-2 text-sm font-semibold text-brand-green transition hover:bg-brand-green hover:text-white"
      >
        Clear filters
      </button>
    </div>
  );
}
