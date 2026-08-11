import { useToastStore } from '../../store/toastStore';
import { CheckCircleIcon } from '../icons';

export default function CartToast() {
  const message = useToastStore((s) => s.message);
  const visible = useToastStore((s) => s.visible);
  const hide = useToastStore((s) => s.hide);

  if (!visible || !message) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[80] w-[min(100vw-2rem,24rem)] -translate-x-1/2 animate-[slideUp_0.35s_ease-out] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-8"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-brand-green/30 bg-brand-green px-4 py-3 text-sm font-bold text-white shadow-lg">
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-white" />
        <span className="min-w-0 flex-1 truncate">{message}</span>
        <button
          type="button"
          onClick={hide}
          className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-white/90 hover:bg-white/15"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
