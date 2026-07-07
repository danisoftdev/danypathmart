import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function CautionAcknowledgeGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [pending, setPending] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (active && Array.isArray(data.pending_cautions) && data.pending_cautions.length > 0) {
          setPending(data.pending_cautions);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const current = pending[idx];
  if (!current) return null;

  const acknowledge = async () => {
    await api.post('/me/cautions/acknowledge', { caution_id: current.id });
    if (idx + 1 < pending.length) {
      setIdx(idx + 1);
    } else {
      setPending([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1E1E1E]">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-red">Account notice</p>
        <h2 className="mt-2 text-lg font-extrabold capitalize">{(current.level || '').replace(/_/g, ' ')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{current.message}</p>
        <button type="button" className="btn-primary mt-6 w-full min-h-[44px]" onClick={acknowledge}>
          I understand
        </button>
      </div>
    </div>
  );
}
