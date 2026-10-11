import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ErrorState, Loading } from '../components/Notice';
import { messageOf, useAsync } from '../hooks';
import { useAuth } from '../auth';

export function ProfilePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const profile = useAsync(() => api.profile(id), [id]);
  const [message, setMessage] = useState<string | null>(null);

  if (profile.loading && !profile.data) return <Loading label="Loading profile" />;
  if (profile.error) return <ErrorState message={profile.error} onRetry={profile.reload} />;
  const person = profile.data;
  if (!person) return null;
  const self = user?.id === person.id;

  return (
    <section className="card">
      <h1>
        {person.displayName} <span className="muted">@{person.username}</span>
      </h1>
      <p>
        <span className={`badge ${person.verificationStatus === 'verified' ? 'badge-green' : 'badge-tag'}`}>
          {person.verificationStatus === 'verified' ? '✓ Verified' : 'Not verified'}
        </span>
      </p>
      {person.bio && <p>{person.bio}</p>}
      <dl className="facts">
        {person.profession && (
          <>
            <dt>Profession</dt>
            <dd>{person.profession}</dd>
          </>
        )}
        {person.education && (
          <>
            <dt>Education</dt>
            <dd>{person.education}</dd>
          </>
        )}
        {person.country && (
          <>
            <dt>Country</dt>
            <dd>{person.country}</dd>
          </>
        )}
        {person.interests.length > 0 && (
          <>
            <dt>Likes</dt>
            <dd>{person.interests.join(', ')}</dd>
          </>
        )}
      </dl>
      {!self && (
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => api.connect(person.id).then(() => setMessage('Request sent.'), (e) => setMessage(messageOf(e)))}>
            Connect
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => api.blockProfile(person.id).then(() => navigate('/feed'), (e) => setMessage(messageOf(e)))}
          >
            Block
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <p>
        <Link to="/feed">← Back to feed</Link>
      </p>
    </section>
  );
}
