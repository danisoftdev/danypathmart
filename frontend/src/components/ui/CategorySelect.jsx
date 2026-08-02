import { flattenCategories } from '../../lib/categories';

function toFlatOptions(categories = []) {
  if (!Array.isArray(categories) || categories.length === 0) return [];
  // Already flattened (has depth from flattenCategories).
  if (typeof categories[0]?.depth === 'number') return categories;
  return flattenCategories(categories);
}

/**
 * Hierarchical category <select> for store filters and admin / seller dashboards.
 * @param {'id'|'slug'} valueKey
 */
export default function CategorySelect({
  categories = [],
  value = '',
  onChange,
  valueKey = 'id',
  emptyLabel = 'All categories',
  className = 'admin-filter-select w-full',
  id,
  name,
  required = false,
  disabled = false,
  'aria-label': ariaLabel = 'Category',
}) {
  const flat = toFlatOptions(categories);
  const getVal = (c) => (valueKey === 'slug' ? c.slug : String(c.id));

  return (
    <select
      id={id}
      name={name}
      className={className}
      value={value ?? ''}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange?.(e.target.value, e)}
    >
      <option value="">{emptyLabel}</option>
      {flat.map((c) => (
        <option key={c.id} value={getVal(c)}>
          {`${'—'.repeat(c.depth || 0)}${(c.depth || 0) > 0 ? ' ' : ''}${c.name}`}
        </option>
      ))}
    </select>
  );
}
