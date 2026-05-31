import { useState } from 'react';
import { useRequestEmailChange, useConfirmEmailChange } from '../../../hooks/account';
import Modal from '../Modal';
import OTPInput from '../../auth/OTPInput';

export default function ChangeEmailModal({ open, onClose, currentEmail, onChanged }) {
  const requestChange = useRequestEmailChange();
  const confirmChange = useConfirmEmailChange();

  const [step, setStep] = useState('form'); // form | verify
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setStep('form');
    setNewEmail('');
    setPassword('');
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const sendCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!newEmail.trim() || !password) {
      setError('Enter your new email and current password.');
      return;
    }
    try {
      await requestChange.mutateAsync({ new_email: newEmail.trim(), current_password: password });
      setStep('verify');
    } catch (e2) {
      setError(e2.response?.data?.message || 'Could not start the email change.');
    }
  };

  const confirm = async (otp) => {
    setError('');
    try {
      await confirmChange.mutateAsync(otp);
      onChanged?.();
      close();
    } catch (e2) {
      setError(e2.response?.data?.message || 'Incorrect or expired code.');
    }
  };

  return (
    <Modal open={open} onClose={close} title="Change email" maxWidth="max-w-md">
      {step === 'form' ? (
        <form onSubmit={sendCode} className="space-y-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            Current email: <span className="font-medium text-black dark:text-white">{currentEmail}</span>
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">New email address</label>
            <input
              type="email"
              className="modal-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Current password</label>
            <input
              type="password"
              className="modal-input"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={requestChange.isPending}>
            {requestChange.isPending ? 'Sending code...' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <div>
          <p className="mb-4 text-sm text-black/60 dark:text-white/60">
            Enter the 6-digit code we sent to{' '}
            <span className="font-medium text-black dark:text-white">{newEmail}</span>.
          </p>
          <OTPInput onComplete={confirm} disabled={confirmChange.isPending} />
          {error && <p className="mt-3 text-center text-sm text-brand-red">{error}</p>}
          <button
            type="button"
            onClick={() => setStep('form')}
            className="mt-4 w-full text-sm font-semibold text-brand-green hover:underline"
          >
            Use a different email
          </button>
        </div>
      )}
    </Modal>
  );
}
