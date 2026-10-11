import { FormEvent, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { messageOf } from '../hooks';

const list = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const [profile, setProfile] = useState({
    displayName: user?.displayName ?? '',
    bio: user?.bio ?? '',
    country: user?.country ?? '',
    education: user?.education ?? '',
    profession: user?.profession ?? '',
    interests: (user?.interests ?? []).join(', '),
    dislikes: (user?.dislikes ?? []).join(', ')
  });
  const [privacy, setPrivacy] = useState(user?.privacy ?? { profileVisibility: 'public' as const, showRecentBubbles: true });
  const [preferences, setPreferences] = useState(user?.preferences ?? { showConnectionPostsInFeed: false, theme: 'system' as const });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const text = (key: keyof typeof profile) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfile((previous) => ({ ...previous, [key]: event.target.value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const updated = await api.updateMe({
        displayName: profile.displayName,
        bio: profile.bio,
        country: profile.country || null,
        education: profile.education || null,
        profession: profile.profession || null,
        interests: list(profile.interests),
        dislikes: list(profile.dislikes),
        privacy,
        preferences
      });
      setUser(updated);
      setMessage({ kind: 'ok', text: 'Settings saved.' });
    } catch (caught) {
      setMessage({ kind: 'error', text: messageOf(caught) });
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    try {
      await api.deleteMe(password);
      signOut();
    } catch (caught) {
      setMessage({ kind: 'error', text: messageOf(caught) });
    }
  }

  return (
    <>
      <h1>Account settings</h1>
      <form className="card" onSubmit={save}>
        <h2>Profile</h2>
        <div className="field">
          <label htmlFor="s-name">Display name</label>
          <input id="s-name" value={profile.displayName} onChange={text('displayName')} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="s-bio">Description</label>
          <textarea id="s-bio" value={profile.bio} onChange={text('bio')} maxLength={500} rows={3} />
        </div>
        <div className="row">
          <div className="field grow">
            <label htmlFor="s-country">Country</label>
            <input id="s-country" value={profile.country} onChange={text('country')} />
          </div>
          <div className="field grow">
            <label htmlFor="s-edu">Education</label>
            <input id="s-edu" value={profile.education} onChange={text('education')} />
          </div>
          <div className="field grow">
            <label htmlFor="s-prof">Profession</label>
            <input id="s-prof" value={profile.profession} onChange={text('profession')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-likes">Likes (comma separated)</label>
          <input id="s-likes" value={profile.interests} onChange={text('interests')} />
        </div>
        <div className="field">
          <label htmlFor="s-dislikes">Dislikes (comma separated)</label>
          <input id="s-dislikes" value={profile.dislikes} onChange={text('dislikes')} />
        </div>

        <h2>Privacy</h2>
        <div className="field">
          <label htmlFor="s-vis">Who can see my profile</label>
          <select
            id="s-vis"
            value={privacy.profileVisibility}
            onChange={(event) => setPrivacy({ ...privacy, profileVisibility: event.target.value as 'public' | 'connections' })}
          >
            <option value="public">Everyone</option>
            <option value="connections">Connections only</option>
          </select>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={privacy.showRecentBubbles}
            onChange={(event) => setPrivacy({ ...privacy, showRecentBubbles: event.target.checked })}
          />
          Show a recent-post bubble to my connections
        </label>

        <h2>Preferences</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={preferences.showConnectionPostsInFeed}
            onChange={(event) => setPreferences({ ...preferences, showConnectionPostsInFeed: event.target.checked })}
          />
          Show my connections&apos; posts in my feed
        </label>
        <div className="field">
          <label htmlFor="s-theme">Theme</label>
          <select
            id="s-theme"
            value={preferences.theme}
            onChange={(event) => setPreferences({ ...preferences, theme: event.target.value as 'system' | 'light' | 'dark' })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'error-text' : 'success-text'}>
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          Save settings
        </button>
      </form>

      <section className="card danger-zone" aria-labelledby="del-h">
        <h2 id="del-h">Delete account</h2>
        <p>Deletion is permanent. There is no hibernation: your profile, posts and connections are removed.</p>
        {!confirmDelete ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete my account
          </button>
        ) : (
          <form onSubmit={deleteAccount}>
            <div className="field">
              <label htmlFor="s-del-pass">Confirm with your password</label>
              <input id="s-del-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-danger">
              Permanently delete
            </button>
          </form>
        )}
      </section>
    </>
  );
}
