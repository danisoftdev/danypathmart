import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWebAuthn } from '../hooks/useWebAuthn';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { registerBiometric, isSupported } = useWebAuthn();
  const [msg, setMsg] = useState('');

  const addPasskey = async () => {
    setMsg('');
    try {
      await registerBiometric('My device');
      setMsg('Passkey registered. You can now log in with biometrics.');
    } catch (err) {
      if (err?.name === 'NotAllowedError') setMsg('Passkey setup was cancelled.');
      else setMsg(err.response?.data?.message || 'Could not register a passkey.');
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold">
        Hi {user?.name?.split(' ')[0] || 'there'} <span className="text-brand-gold">.</span>
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {user?.email} &middot; role: {user?.role}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-black/5 p-5 dark:border-white/10">
          <h2 className="font-semibold">Security</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Two-factor: {user?.totp_enabled ? 'enabled' : 'off'}
          </p>
          {isSupported && (
            <button type="button" onClick={addPasskey} className="btn-ghost mt-3 w-full">
              Add a passkey / biometric
            </button>
          )}
          {msg && <p className="mt-3 text-sm text-brand-green">{msg}</p>}
        </div>

        <div className="rounded-xl border border-black/5 p-5 dark:border-white/10">
          <h2 className="font-semibold">Account</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Full dashboard arrives on Day 4.
          </p>
          <button type="button" onClick={logout} className="btn-primary mt-3 w-full">
            Log out
          </button>
        </div>
      </div>
    </section>
  );
}
