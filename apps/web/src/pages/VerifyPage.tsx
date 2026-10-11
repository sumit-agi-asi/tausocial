import { FormEvent, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { messageOf } from '../hooks';

const LABELS = {
  unverified: 'Not verified',
  pending: 'Verification pending review',
  verified: 'Verified',
  rejected: 'Verification rejected'
} as const;

export function VerifyPage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ phone: '', govIdRef: '', addressProofRef: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.submitVerification(form);
      setDone(true);
      setUser(await api.me());
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1>Verify your identity</h1>
      <p>
        Accountability starts with real people. Status: <strong>{user ? LABELS[user.verificationStatus] : ''}</strong>
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="v-phone">Phone (international format)</label>
          <input id="v-phone" type="tel" autoComplete="tel" placeholder="+14155550123" required value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="v-id">Government ID document reference</label>
          <input id="v-id" required value={form.govIdRef} onChange={set('govIdRef')} aria-describedby="v-help" />
        </div>
        <div className="field">
          <label htmlFor="v-addr">Address proof document reference</label>
          <input id="v-addr" required value={form.addressProofRef} onChange={set('addressProofRef')} aria-describedby="v-help" />
        </div>
        <p id="v-help" className="muted small">
          Document upload to private storage is not available yet; enter the reference provided by support.
        </p>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="success-text">
            Submitted. We will review your documents.
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit for verification'}
        </button>
      </form>
    </section>
  );
}
