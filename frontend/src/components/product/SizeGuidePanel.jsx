import { useState } from 'react';
import api from '../../lib/api';

const EMPTY_MEAS = { chest: '', waist: '', height: '' };

export default function SizeGuidePanel({ guide }) {
  const [open, setOpen] = useState(false);
  const [meas, setMeas] = useState(EMPTY_MEAS);
  const [suggestion, setSuggestion] = useState(null);
  const [suggestError, setSuggestError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!guide?.rows?.length) return null;

  const suggest = async (e) => {
    e.preventDefault();
    setSuggestError('');
    setSuggestion(null);
    const chest = meas.chest !== '' ? Number(meas.chest) : null;
    const waist = meas.waist !== '' ? Number(meas.waist) : null;
    const height = meas.height !== '' ? Number(meas.height) : null;
    if (!chest && !waist && !height) {
      setSuggestError('Enter at least one measurement (cm).');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/size-guides/suggest', {
        size_guide_id: guide.id,
        chest,
        waist,
        height,
      });
      setSuggestion(res.data.suggestion);
      if (!res.data.suggestion) {
        setSuggestError('No matching size — check the chart or contact support.');
      }
    } catch (err) {
      setSuggestError(err.response?.data?.message || 'Could not suggest a size.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-bold text-[#111111] dark:text-white">Size guide &amp; fit helper</span>
        <span className="text-muted">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {guide.notes && <p className="text-xs text-muted">{guide.notes}</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="py-2 pr-2 font-bold">Size</th>
                  <th className="py-2 pr-2 font-bold">Chest (cm)</th>
                  <th className="py-2 pr-2 font-bold">Waist (cm)</th>
                  <th className="py-2 font-bold">Height (cm)</th>
                </tr>
              </thead>
              <tbody>
                {guide.rows.map((row) => (
                  <tr key={row.id ?? row.size_label} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-2 font-semibold">{row.size_label}</td>
                    <td className="py-2 pr-2 text-muted">{fmtRange(row.chest_min, row.chest_max)}</td>
                    <td className="py-2 pr-2 text-muted">{fmtRange(row.waist_min, row.waist_max)}</td>
                    <td className="py-2 text-muted">{fmtRange(row.height_min, row.height_max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form onSubmit={suggest} className="rounded-xl bg-[#FFF9F3] p-3 dark:bg-black/20">
            <p className="text-xs font-bold text-[#111111] dark:text-white">Suggested size (optional)</p>
            <p className="mt-0.5 text-xs text-muted">Enter your body measurements in centimetres.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {['chest', 'waist', 'height'].map((key) => (
                <label key={key} className="text-xs">
                  <span className="mb-1 block capitalize text-muted">{key} (cm)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="input-field py-2 text-sm"
                    value={meas[key]}
                    onChange={(e) => setMeas((m) => ({ ...m, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            {suggestError && <p className="mt-2 text-xs text-brand-red">{suggestError}</p>}
            {suggestion && (
              <p className="mt-2 text-sm font-bold text-brand-green">
                Suggested size: {suggestion.size_label}
                {suggestion.confidence === 'high' ? ' (good match)' : ' (approximate)'}
              </p>
            )}
            <button type="submit" disabled={loading} className="btn-secondary mt-3 w-full py-2 text-sm">
              {loading ? 'Checking…' : 'Get suggested size'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function fmtRange(min, max) {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  return `≤ ${max}`;
}
