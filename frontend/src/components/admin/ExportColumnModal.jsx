import { useEffect, useState } from 'react';
import {
  EXPORT_COLUMN_SETS,
  defaultExportColumns,
  loadExportColumnPrefs,
  saveExportColumnPrefs,
} from '../../lib/exportColumns';

export default function ExportColumnModal({ open, type, title = 'Export CSV', onClose, onExport, exporting }) {
  const columnSet = EXPORT_COLUMN_SETS[type] || [];
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!open || !type) return;
    setSelected(loadExportColumnPrefs(type) || defaultExportColumns(type));
  }, [open, type]);

  if (!open) return null;

  const toggle = (key) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelected(columnSet.map((c) => c.key));
  const selectDefaults = () => setSelected(defaultExportColumns(type));

  const submit = () => {
    if (selected.length === 0) return;
    saveExportColumnPrefs(type, selected);
    onExport(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-[#1E1E1E] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="mt-1 text-sm text-muted">Choose columns to include. Your selection is remembered.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={selectAll} className="text-xs font-bold text-brand-green">
            Select all
          </button>
          <button type="button" onClick={selectDefaults} className="text-xs font-bold text-muted">
            Reset defaults
          </button>
        </div>

        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {columnSet.map((col) => (
            <li key={col.key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/8 px-3 py-2 text-sm dark:border-white/10">
                <input
                  type="checkbox"
                  checked={selected.includes(col.key)}
                  onChange={() => toggle(col.key)}
                  className="h-4 w-4 accent-brand-green"
                />
                <span>{col.label}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={exporting || selected.length === 0}
            className="btn-primary flex-1"
          >
            {exporting ? 'Exporting…' : `Export (${selected.length})`}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 font-bold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
