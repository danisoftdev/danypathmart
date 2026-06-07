import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

function FieldInput({ field, value, file, onChange, onFileChange }) {
  const required = field.is_required;
  const label = (
    <>
      {field.label}
      {required ? <span className="text-brand-red"> *</span> : null}
      {!required ? <span className="font-normal text-muted"> (optional)</span> : null}
    </>
  );

  const common = {
    className: 'input-field w-full',
    required,
  };

  if (field.field_type === 'textarea') {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{label}</span>
        <textarea
          {...common}
          className="input-field min-h-[120px] w-full resize-y"
          placeholder={field.placeholder || ''}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.help_text ? <p className="mt-1 text-xs text-muted">{field.help_text}</p> : null}
      </label>
    );
  }

  if (field.field_type === 'file') {
    const accept = (field.accepted_extensions || 'pdf,doc,docx')
      .split(',')
      .map((e) => `.${e.trim()}`)
      .join(',');
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{label}</span>
        <input
          type="file"
          className="input-field w-full py-2"
          accept={accept}
          required={required && !file}
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />
        {field.help_text ? <p className="mt-1 text-xs text-muted">{field.help_text}</p> : null}
        <p className="mt-1 text-xs text-muted">
          Allowed: {field.accepted_extensions || 'pdf,doc,docx'} · Max {field.max_file_mb || 5}MB
        </p>
        {file ? <p className="mt-1 text-xs font-medium text-brand-green">Selected: {file.name}</p> : null}
      </label>
    );
  }

  if (field.field_type === 'select') {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{label}</span>
        <select
          className="input-field w-full"
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {field.help_text ? <p className="mt-1 text-xs text-muted">{field.help_text}</p> : null}
      </label>
    );
  }

  const inputType =
    field.field_type === 'email'
      ? 'email'
      : field.field_type === 'phone'
        ? 'tel'
        : field.field_type === 'number'
          ? 'number'
          : field.field_type === 'url'
            ? 'url'
            : field.field_type === 'date'
              ? 'date'
              : 'text';

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">{label}</span>
      <input
        {...common}
        type={inputType}
        placeholder={field.placeholder || ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.help_text ? <p className="mt-1 text-xs text-muted">{field.help_text}</p> : null}
    </label>
  );
}

export default function DynamicApplicationForm({ job, onSubmit, submitting }) {
  const user = useAuthStore((s) => s.user);
  const fields = job?.fields ?? [];

  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach((f) => {
      if (f.field_type === 'file') return;
      if (f.field_key === 'full_name' || f.field_key === 'name') init[f.id] = user?.name || '';
      else if (f.field_key === 'email') init[f.id] = user?.email || '';
      else init[f.id] = '';
    });
    return init;
  });
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const setValue = (fieldId, val) => setValues((v) => ({ ...v, [fieldId]: val }));
  const setFile = (fieldId, file) => setFiles((f) => ({ ...f, [fieldId]: file }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const fd = new FormData();
    fd.append('job_post_id', String(job.id));

    for (const field of fields) {
      if (field.field_type === 'file') {
        const file = files[field.id];
        if (field.is_required && !file) {
          setError(`${field.label} is required.`);
          return;
        }
        if (file) fd.append(`field_${field.id}`, file);
      } else {
        const val = (values[field.id] ?? '').trim();
        if (field.is_required && !val) {
          setError(`${field.label} is required.`);
          return;
        }
        if (val) fd.append(`field_${field.id}`, val);
      }
    }

    try {
      await onSubmit(fd);
      setSent(true);
      setFiles({});
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your application. Please try again.');
    }
  };

  if (!fields.length) {
    return (
      <p className="rounded-xl border border-black/8 bg-white p-5 text-sm text-muted dark:border-white/10 dark:bg-[#1E1E1E]">
        This role is not accepting applications yet.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] md:p-6"
    >
      <h2 className="text-lg font-extrabold">Application form</h2>
      <p className="text-sm text-muted">
        Fields marked with <span className="text-brand-red">*</span> are required.
      </p>

      {sent && (
        <p className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-green">
          Thank you — your application was submitted successfully.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {error}
        </p>
      )}

      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id] ?? ''}
          file={files[field.id]}
          onChange={(val) => setValue(field.id, val)}
          onFileChange={(file) => setFile(field.id, file)}
        />
      ))}

      <button type="submit" disabled={submitting || sent} className="btn-primary w-full py-3 sm:w-auto sm:px-8">
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
