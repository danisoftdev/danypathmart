import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../lib/api';
import OTPInput from './OTPInput';

/**
 * Reusable TOTP enrollment flow: scan QR -> confirm code -> save backup codes.
 * Calls onComplete() once 2FA is fully enabled.
 */
export default function TwoFactorSetup({ onComplete }) {
  const [step, setStep] = useState('loading'); // loading | scan | done
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.post('/auth/2fa/setup');
        if (!active) return;
        setQrUri(data.qr_uri || data.otpauth_uri);
        setSecret(data.secret);
        setStep('scan');
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || 'Could not start 2FA setup.');
        setStep('scan');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const confirm = async (code) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/confirm', { totp_code: code });
      setBackupCodes(data.backup_codes || []);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'That code was incorrect. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'danypathmart-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (step === 'loading') {
    return <p className="py-8 text-center text-sm text-muted">Preparing your authenticator...</p>;
  }

  if (step === 'done') {
    return (
      <div>
        <h2 className="mb-1 text-xl font-bold">Save your backup codes</h2>
        <p className="mb-4 text-sm text-muted">
          Store these somewhere safe. Each code works once if you lose your device.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/5 p-4 font-mono text-sm dark:bg-white/10">
          {backupCodes.map((code) => (
            <span key={code} className="tracking-widest">{code}</span>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={copyCodes} className="btn-ghost flex-1">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button type="button" onClick={downloadCodes} className="btn-ghost flex-1">
            Download
          </button>
        </div>
        <button type="button" onClick={onComplete} className="btn-primary mt-4 w-full">
          I&apos;ve saved my codes
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold">Set up two-factor authentication</h2>
      <p className="mb-4 text-sm text-muted">
        Scan this QR code with Google Authenticator, Authy or 1Password.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}

      {qrUri && (
        <div className="mb-4 flex justify-center">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={qrUri} size={192} />
          </div>
        </div>
      )}

      {secret && (
        <p className="mb-5 break-all text-center text-xs text-muted">
          Can&apos;t scan? Enter this key: <span className="font-mono font-semibold">{secret}</span>
        </p>
      )}

      <p className="mb-2 text-center text-sm font-medium">Enter the 6-digit code to confirm</p>
      <OTPInput onComplete={confirm} disabled={submitting} />
    </div>
  );
}
