import { useState } from 'react';
import { uploadCustomProof } from '../../hooks/phaseF';

export default function CustomProofFields({ productId, productName, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await uploadCustomProof(file);
      onChange({ ...value, file_path: res.file_path });
    } catch (err) {
      setError(err?.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
      <p className="text-sm font-bold text-brand-green">Custom artwork — {productName}</p>
      <p className="mt-1 text-xs text-muted">Upload logo or names. Admin approves a digital proof before production.</p>
      <label className="mt-3 block text-xs font-bold uppercase text-muted">
        Names / text on badge
        <input
          className="input-field mt-1 text-sm"
          value={value?.label_text || ''}
          onChange={(e) => onChange({ ...value, label_text: e.target.value })}
          placeholder="e.g. Daniel M · Pathfinders 2026"
        />
      </label>
      <label className="mt-3 block text-xs font-bold uppercase text-muted">
        Logo / artwork
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="mt-1 block w-full text-sm"
          onChange={pickFile}
          disabled={uploading}
        />
      </label>
      {value?.file_path && (
        <p className="mt-2 text-xs text-brand-green">✓ Artwork uploaded</p>
      )}
      {uploading && <p className="mt-2 text-xs text-muted">Uploading…</p>}
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
    </div>
  );
}
