import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

function useSubmitPromoterApplication() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/promoter-applications', payload)).data,
  });
}

export default function BecomeAPromoterPage() {
  const user = useAuthStore((s) => s.user);
  const submit = useSubmitPromoterApplication();
  const [form, setForm] = useState({
    full_name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    city: '',
    experience: '',
    why_join: '',
  });
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await submit.mutateAsync({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        experience: form.experience.trim(),
        why_join: form.why_join.trim(),
      });
      setSent(true);
      if (data?.email_sent === false) {
        setError('Application saved, but the confirmation email could not be sent. Check spam later or contact us.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your application. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 md:py-12">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand-green">Home</Link>
        <span className="mx-2">/</span>
        <span>Become a promoter</span>
      </nav>

      <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">
        Become a promoter
      </h1>
      <p className="mt-2 text-muted">
        Refer new shops to DanyPathMart and earn when they join. Fill in your details below —
        we will email you a copy and notify our team.
      </p>

      {sent ? (
        <div className="mt-6 rounded-2xl border border-brand-green/30 bg-brand-green/10 px-5 py-6">
          <p className="font-bold text-brand-green">Application received</p>
          <p className="mt-2 text-sm text-muted">
            Check your inbox for a copy of what you sent. If approved, we will email login details
            to <strong className="text-[#111111] dark:text-white">{form.email.trim()}</strong>.
          </p>
          <Link to="/" className="btn-primary mt-5 inline-block min-h-[44px] px-6 leading-[44px]">
            Back to home
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <p className="mt-4 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
              {error}
            </p>
          )}

          <form
            onSubmit={onSubmit}
            className="mt-6 space-y-4 rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] md:p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold">Full name</span>
                <input
                  className="input-field w-full"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">Email</span>
                <input
                  type="email"
                  className="input-field w-full"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">Phone</span>
                <input
                  type="tel"
                  className="input-field w-full"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                  autoComplete="tel"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold">City</span>
                <input
                  className="input-field w-full"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  required
                  autoComplete="address-level2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold">Sales / referral experience (optional)</span>
                <textarea
                  className="input-field w-full min-h-[88px]"
                  value={form.experience}
                  onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                  rows={3}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold">Why do you want to become a promoter?</span>
                <textarea
                  className="input-field w-full min-h-[120px]"
                  value={form.why_join}
                  onChange={(e) => setForm((f) => ({ ...f, why_join: e.target.value }))}
                  required
                  rows={4}
                />
              </label>
            </div>
            <button
              type="submit"
              className="btn-primary w-full min-h-[48px] sm:w-auto sm:px-8"
              disabled={submit.isPending}
            >
              {submit.isPending ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
