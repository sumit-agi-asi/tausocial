import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { messageOf } from '../hooks';

function Field(props: { label: string; id: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { label, id, error, ...input } = props;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...input} />
      {error && (
        <p id={`${id}-error`} className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/feed" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      signIn(await api.login({ email, password }));
      navigate('/feed');
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card auth-card">
      <h1>Log in</h1>
      <p className="muted">Social media with accountability, monitored by intelligence.</p>
      <form onSubmit={submit} noValidate={false}>
        <Field label="Email" id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p>
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </section>
  );
}

export function SignupPage() {
  const { user, signIn } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', birthDate: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);

  if (user) return <Navigate to={registered ? '/verify' : '/feed'} replace />;

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api.register(form);
      setRegistered(true);
      signIn(session);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card auth-card">
      <h1>Sign up</h1>
      <form onSubmit={submit}>
        <Field label="Username" id="su-username" autoComplete="username" required pattern="[A-Za-z0-9_]{3,30}" value={form.username} onChange={set('username')} />
        <Field label="Email" id="su-email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Field
          label="Password (at least 10 characters)"
          id="su-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={form.password}
          onChange={set('password')}
        />
        <Field label="Date of birth" id="su-birth" type="date" required value={form.birthDate} onChange={set('birthDate')} />
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>
        Already a member? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
