import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

function useSubmitContact() {
  return useMutation({
    mutationFn: async (payload) => (await api.post('/public/contact', payload)).data,
  });
}

export default function ContactPage() {
  const user = useAuthStore((s) => s.user);
  const submit = useSubmitContact();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    subject: '',
    message: '',
  });
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await submit.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSent(true);
      setForm((f) => ({ ...f, subject: '', message: '' }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send your message. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 md:py-12">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand-green">Home</Link>
        <span className="mx-2">/</span>
        <span>Contact</span>
      </nav>

      <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">Contact us</h1>
      <p className="mt-2 text-muted">
        Questions about an order, products, or delivery? Send us a message and we will reply as soon as we can.
      </p>

      {sent && (
        <p className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-green">
          Thank you — your message was sent successfully.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] md:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Your name</span>
            <input
              className="input-field w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
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
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Subject <span className="font-normal text-muted">(optional)</span></span>
          <input
            className="input-field w-full"
            placeholder="e.g. Order question, product availability"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Message</span>
          <textarea
            className="input-field min-h-[140px] w-full resize-y"
            placeholder="How can we help?"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            required
          />
        </label>
        <button type="submit" disabled={submit.isPending} className="btn-primary w-full py-3 sm:w-auto sm:px-8">
          {submit.isPending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  );
}
