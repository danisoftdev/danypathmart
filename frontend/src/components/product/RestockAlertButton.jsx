import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  useRestockAlertStatus,
  useSubscribeRestockAlert,
  useUnsubscribeRestockAlert,
} from '../../hooks/phaseF';

export default function RestockAlertButton({ productId, productName, tags = [] }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data } = useRestockAlertStatus(productId);
  const subscribe = useSubscribeRestockAlert();
  const unsubscribe = useUnsubscribeRestockAlert();
  const [clubTag, setClubTag] = useState('');
  const [message, setMessage] = useState('');

  const subscribed = data?.subscriptions?.some((s) => s.subscribed) ?? false;

  const toggle = async () => {
    setMessage('');
    try {
      if (subscribed) {
        await unsubscribe.mutateAsync({ product_id: productId, club_tag: clubTag || undefined });
        setMessage('Alert removed.');
      } else {
        await subscribe.mutateAsync({
          product_id: productId,
          club_tag: clubTag.trim() || undefined,
        });
        setMessage(`We will email you when ${productName} is back.`);
      }
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Could not save alert.');
    }
  };

  if (!isAuthenticated) {
    return (
      <p className="text-sm text-muted">
        <Link to="/login" className="font-semibold text-brand-green hover:underline">
          Sign in
        </Link>{' '}
        to get notified when this item is back in stock.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-4">
      <p className="text-sm font-bold text-[#111111] dark:text-white">Notify me when back in stock</p>
      <p className="mt-1 text-xs text-muted">
        Targeted alert for {productName}
        {tags.length > 0 ? ` · optional club tag below` : ''}
      </p>
      {tags.length > 0 && (
        <input
          className="input-field mt-3 text-sm"
          placeholder="Club tag (optional) e.g. Pathfinders"
          value={clubTag}
          onChange={(e) => setClubTag(e.target.value)}
          list={`club-tags-${productId}`}
        />
      )}
      {tags.length > 0 && (
        <datalist id={`club-tags-${productId}`}>
          {tags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={subscribe.isPending || unsubscribe.isPending}
        className="btn-secondary mt-3 w-full py-2.5 text-sm"
      >
        {subscribed ? 'Cancel alert' : 'Notify me'}
      </button>
      {message && <p className="mt-2 text-xs font-semibold text-brand-green">{message}</p>}
    </div>
  );
}
