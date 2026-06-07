import { useState } from 'react';
import Modal from '../dashboard/Modal';

function PromptDialogForm({
  onClose,
  onSubmit,
  title,
  label,
  defaultValue,
  submitLabel,
  loading,
}) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
  };

  return (
    <Modal open onClose={loading ? undefined : onClose} title={title} maxWidth="max-w-md">
      <form onSubmit={handleSubmit}>
        <label className="mb-1 block text-sm font-semibold">{label}</label>
        <input
          className="input-field mb-6"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={loading || !value.trim()} className="btn-primary">
            {loading ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  label,
  defaultValue = '',
  submitLabel = 'Save',
  loading = false,
}) {
  if (!open) return null;

  return (
    <PromptDialogForm
      key={defaultValue}
      onClose={onClose}
      onSubmit={onSubmit}
      title={title}
      label={label}
      defaultValue={defaultValue}
      submitLabel={submitLabel}
      loading={loading}
    />
  );
}
