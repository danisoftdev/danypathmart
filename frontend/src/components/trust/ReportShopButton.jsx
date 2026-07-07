import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../lib/api';

const REASONS = [
  { value: 'no_delivery', label: 'No delivery' },
  { value: 'payment_ignored', label: 'Payment ignored' },
  { value: 'wrong_items', label: 'Wrong items' },
  { value: 'pricing_scam', label: 'Pricing scam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'counterfeit', label: 'Counterfeit' },
  { value: 'other', label: 'Other' },
];

export default function ReportShopButton({ orderId, shopName }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('no_delivery');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: async () =>
      (await api.post('/shop-reports', { order_id: orderId, reason, description })).data,
    onSuccess: () => {
      setDone(true);
      setTimeout(() => setOpen(false), 2000);
    },
  });

  if (!orderId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold text-brand-red hover:underline"
      >
        Report shop{shopName ? ` (${shopName})` : ''}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-[#1E1E1E]"
            onSubmit={async (e) => {
              e.preventDefault();
              await submit.mutateAsync();
            }}
          >
            <h3 className="font-extrabold">Report this shop</h3>
            <p className="mt-1 text-xs text-muted">Reports require an order. We review all submissions.</p>
            {done ? (
              <p className="mt-4 text-sm font-bold text-brand-green">Report submitted. Thank you.</p>
            ) : (
              <>
                <select
                  className="mt-4 w-full rounded-xl border px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <textarea
                  className="mt-3 w-full rounded-xl border px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  rows={4}
                  placeholder="Describe the issue (min 10 characters)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={10}
                />
                {submit.isError && (
                  <p className="mt-2 text-sm text-brand-red">
                    {submit.error?.response?.data?.message || 'Could not submit report.'}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button type="button" className="flex-1 rounded-xl border py-2 text-sm font-bold" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submit.isPending} className="btn-primary flex-1 min-h-[40px]">
                    Submit
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}
