import { useState } from 'react';
import Modal from '../dashboard/Modal';

function PromptDialogForm({
  onClose,
  onSubmit,
  title,
  label,
  description,
  defaultValue,
  expectedValue,
  submitLabel,
  loading,
  variant = 'primary',
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    if (expectedValue != null && trimmed !== String(expectedValue)) {
      setError('Text does not match. Check spelling and try again.');
      return;
    }
    setError('');
    onSubmit(trimmed);
  };

  return (
    <Modal open onClose={loading ? undefined : onClose} title={title} maxWidth="max-w-md">
      <form onSubmit={handleSubmit}>
        {description ? (
          <p className="mb-4 whitespace-pre-line text-sm text-muted">{description}</p>
        ) : null}
        <label className="mb-1 block text-sm font-semibold">{label}</label>
        <input
          className="input-field mb-2"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError('');
          }}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {error ? <p className="mb-4 text-xs font-semibold text-brand-red">{error}</p> : <div className="mb-4" />}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
          >
            {loading ? 'Please wait…' : submitLabel}
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
  description = '',
  defaultValue = '',
  expectedValue = null,
  submitLabel = 'Save',
  loading = false,
  variant = 'primary',
}) {
  if (!open) return null;

  return (
    <PromptDialogForm
      key={`${defaultValue}|${expectedValue ?? ''}`}
      onClose={onClose}
      onSubmit={onSubmit}
      title={title}
      label={label}
      description={description}
      defaultValue={defaultValue}
      expectedValue={expectedValue}
      submitLabel={submitLabel}
      loading={loading}
      variant={variant}
    />
  );
}
