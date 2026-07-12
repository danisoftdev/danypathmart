import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';

/**
 * Debounced live uniqueness check with a verified tick when available.
 * @param {'email'|'username'|'name'|'shop_name'|'shop_slug'} type
 */
export function useAvailabilityCheck(type, value, { excludeUserId, excludeShopId, enabled = true, minLength = 2 } = {}) {
  const [state, setState] = useState({
    checking: false,
    available: null,
    verified: false,
    message: '',
  });
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = String(value || '').trim();
    if (!enabled || trimmed.length < minLength) {
      setState({ checking: false, available: null, verified: false, message: '' });
      return undefined;
    }

    const mySeq = ++seq.current;
    setState((s) => ({ ...s, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const params = { type, value: trimmed };
        if (excludeUserId) params.exclude_user_id = excludeUserId;
        if (excludeShopId) params.exclude_shop_id = excludeShopId;
        const { data } = await api.get('/public/availability', { params });
        if (mySeq !== seq.current) return;
        setState({
          checking: false,
          available: !!data.available,
          verified: !!data.verified,
          message: data.message || '',
        });
      } catch {
        if (mySeq !== seq.current) return;
        setState({ checking: false, available: null, verified: false, message: '' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [type, value, excludeUserId, excludeShopId, enabled, minLength]);

  return state;
}

export function VerifiedTick({ show, label = 'Available' }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green" title={label}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L9 11.94l-1.72-1.72a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}

/** Status line under an input: checking / error / verified tick. */
export function AvailabilityHint({ check }) {
  if (check.checking) {
    return <p className="mt-1.5 text-xs text-muted">Checking…</p>;
  }
  if (check.available === false && check.message) {
    return (
      <p className="mt-1.5 text-xs font-medium text-brand-red" role="alert">
        {check.message}
      </p>
    );
  }
  if (check.verified) {
    return (
      <p className="mt-1.5">
        <VerifiedTick show label={check.message || 'Available'} />
      </p>
    );
  }
  return null;
}
