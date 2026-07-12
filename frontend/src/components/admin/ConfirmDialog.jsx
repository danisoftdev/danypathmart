import Modal from '../dashboard/Modal';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={loading ? undefined : onClose} title={title} maxWidth="max-w-md">
      <div className="mb-6 whitespace-pre-line text-sm text-muted">{message}</div>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
