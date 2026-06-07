import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../icons';

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
  compact = false,
  scroll = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex justify-center p-3 sm:p-4 ${
        scroll ? 'items-end overflow-y-auto sm:items-center' : 'items-center overflow-hidden'
      }`}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className={`relative z-10 w-full rounded-2xl bg-white shadow-xl dark:bg-[#1c1c1c] ${maxWidth} ${compact ? 'p-4' : 'p-6'} ${
          scroll ? 'flex max-h-[90vh] flex-col overflow-hidden' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-2' : 'mb-4'} ${scroll ? 'shrink-0' : ''}`}>
          <h2 id="modal-title" className={`font-bold leading-tight ${compact ? 'text-base' : 'text-lg'}`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1 text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {scroll ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer ? (
              <div className={`shrink-0 border-t border-black/10 pt-3 dark:border-white/10 ${compact ? 'mt-2' : 'mt-4'}`}>
                {footer}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {children}
            {footer}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
