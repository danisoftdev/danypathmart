import { formatPrice } from '../../lib/currency';
import { useAirLabels } from '../../hooks/checkout';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
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

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-gold">{title}</h3>
      {children}
    </div>
  );
}

export default function FiltersPanel({ categories, facets, filters, update, onClear }) {
  const labels = useAirLabels();
  const priceMax = Math.max(facets?.price_max || 500, 100);
  const priceMin = facets?.price_min ?? 0;
  const tags = facets?.tags ?? [];

  const activeChips = [
    filters.search && { key: 'search', label: `“${filters.search}”`, clear: { search: '' } },
    filters.category && {
      key: 'category',
      label: categories.find((c) => c.slug === filters.category)?.name || filters.category,
      clear: { category: '' },
    },
    filters.tag && { key: 'tag', label: filters.tag, clear: { tag: '' } },
    filters.price_min !== '' && filters.price_min != null && {
      key: 'min',
      label: `Min ${formatPrice(filters.price_min)}`,
      clear: { price_min: '' },
    },
    filters.price_max !== '' && filters.price_max != null && Number(filters.price_max) < priceMax && {
      key: 'max',
      label: `Max ${formatPrice(filters.price_max)}`,
      clear: { price_max: '' },
    },
    filters.in_stock === '1' && { key: 'stock', label: 'In stock', clear: { in_stock: '' } },
    filters.is_preorder === '1' && { key: 'pre', label: labels.filter, clear: { is_preorder: '' } },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => update(chip.clear)}
              className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-1 text-xs font-semibold text-brand-green"
            >
              {chip.label}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <Section title="Search">
        <input
          type="search"
          placeholder="Name, description, tags…"
          value={filters.search ?? ''}
          onChange={(e) => update({ search: e.target.value })}
          className="modal-input w-full text-sm"
        />
      </Section>

      <Section title="Categories">
        <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
          {categories.length === 0 ? (
            <p className="text-xs text-muted">No categories yet.</p>
          ) : (
            categories.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 py-0.5 text-sm"
                style={{ paddingLeft: `${(c.depth || 0) * 12}px` }}
              >
                <input
                  type="radio"
                  name="shop-category"
                  checked={filters.category === c.slug}
                  onChange={() => update({ category: filters.category === c.slug ? '' : c.slug })}
                  className="h-4 w-4 accent-brand-green"
                />
                {c.name}
              </label>
            ))
          )}
        </div>
      </Section>

      {tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = filters.tag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => update({ tag: active ? '' : tag })}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-semibold transition',
                    active
                      ? 'bg-brand-green text-white'
                      : 'bg-black/5 text-[#111111] hover:bg-brand-green/15 dark:bg-white/10 dark:text-white',
                  ].join(' ')}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Price (GHS)">
        <input
          type="range"
          min={priceMin}
          max={priceMax}
          step="5"
          value={filters.price_max !== '' && filters.price_max != null ? Number(filters.price_max) : priceMax}
          onChange={(e) => update({ price_max: Number(e.target.value) })}
          className="w-full accent-brand-green"
        />
        <p className="mt-1 text-xs text-muted">
          Catalogue range {formatPrice(priceMin)} – {formatPrice(priceMax)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Min"
            value={filters.price_min ?? ''}
            onChange={(e) => update({ price_min: e.target.value })}
            className="modal-input px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Max"
            value={filters.price_max ?? ''}
            onChange={(e) => update({ price_max: e.target.value })}
            className="modal-input px-2 py-1.5 text-sm"
          />
        </div>
      </Section>

      <Section title="Availability">
        <Toggle
          label="In stock only"
          checked={filters.in_stock === '1'}
          onChange={() => update({ in_stock: filters.in_stock === '1' ? '' : '1' })}
        />
        <Toggle
          label={labels.filterOnly}
          checked={filters.is_preorder === '1'}
          onChange={() => update({ is_preorder: filters.is_preorder === '1' ? '' : '1' })}
        />
      </Section>

      <button
        type="button"
        onClick={onClear}
        className="w-full rounded-lg border border-brand-green px-3 py-2.5 text-sm font-semibold text-brand-green transition hover:bg-brand-green hover:text-white"
      >
        Clear all filters
      </button>
    </div>
  );
}
