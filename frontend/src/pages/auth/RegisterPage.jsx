import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import PasswordStrength from '../../components/auth/PasswordStrength';
import StepProgress from '../../components/auth/StepProgress';
import FormField, { AuthAlert } from '../../components/auth/FormField';
import SocialAuthButtons, { SocialAuthSetupHint } from '../../components/auth/SocialAuthButtons';
import { meetsPolicy } from '../../lib/password';

const STEPS = ['Your details', 'Secure password'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm_password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [key]: '' }));
  };

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()), [form.email]);

  const validateStep1 = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Please enter your full name.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!emailValid) errs.email = 'Enter a valid email address.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!meetsPolicy(form.password)) {
      errs.password = 'Use 8+ characters with an uppercase letter and a number.';
    }
    if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    setError('');
    if (step === 1 && validateStep1()) setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      navigate('/verify-email', { state: { userId: data.user_id, email: data.email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="auth-card-lg">
      <div className="mb-2 text-center sm:text-left">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Create your account</h1>
        <p className="mt-2 text-base text-muted">Join DanyPathMart — insignias, uniforms &amp; more.</p>
      </div>

      <StepProgress step={step} total={2} labels={STEPS} />

      {error && <AuthAlert type="error">{error}</AuthAlert>}

      <div className="mb-6">
        <SocialAuthButtons mode="register" />
      </div>

      {step === 1 && (
        <>
          <FormField label="Full name" required error={fieldErrors.name}>
            <input
              className="input-field min-h-[48px] text-base"
              value={form.name}
              onChange={set('name')}
              autoComplete="name"
              placeholder="Adventurer Name"
            />
          </FormField>

          <FormField
            label="Email address"
            required
            error={fieldErrors.email}
            success={form.email && emailValid ? 'Email looks good' : undefined}
          >
            <input
              type="email"
              className="input-field min-h-[48px] text-base"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </FormField>

          <button type="button" onClick={nextStep} className="btn-primary mt-2 min-h-[48px] w-full text-base">
            Continue
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <FormField label="Password" required error={fieldErrors.password}>
            <input
              type="password"
              className="input-field min-h-[48px] text-base"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              placeholder="Create a strong password"
            />
          </FormField>
          <PasswordStrength password={form.password} showRules />

          <FormField
            label="Confirm password"
            required
            error={fieldErrors.confirm_password}
            success={
              form.confirm_password && form.password === form.confirm_password
                ? 'Passwords match'
                : undefined
            }
          >
            <input
              type="password"
              className="input-field min-h-[48px] text-base"
              value={form.confirm_password}
              onChange={set('confirm_password')}
              autoComplete="new-password"
              placeholder="Repeat your password"
            />
          </FormField>

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-ghost min-h-[48px] flex-1">
              Back
            </button>
            <button type="submit" className="btn-primary min-h-[48px] flex-1 text-base" disabled={loading}>
              {loading ? 'Creating...' : 'Create account with email'}
            </button>
          </div>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-brand-green hover:underline">
          Sign in
        </Link>
      </p>
      <div className="mt-4">
        <SocialAuthSetupHint />
      </div>
    </form>
  );
}
