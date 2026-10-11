import { useState } from 'react';
import { api } from '../api';
import { EmptyState, ErrorState, Loading } from '../components/Notice';
import { messageOf, useAsync } from '../hooks';

export function ConnectionsPage() {
  const connections = useAsync(() => api.connections(), []);
  const recommendations = useAsync(() => api.recommendations(), []);
  const [error, setError] = useState<string | null>(null);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      connections.reload();
      recommendations.reload();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return (
    <>
      <h1>Connections</h1>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      <section aria-labelledby="rec-h">
        <h2 id="rec-h">People like you</h2>
        {recommendations.loading && !recommendations.data && <Loading />}
        {recommendations.error && <ErrorState message={recommendations.error} onRetry={recommendations.reload} />}
        {recommendations.data && recommendations.data.recommendations.length === 0 && (
          <EmptyState title="No recommendations yet">Complete your profile (country, education, interests) to get matches.</EmptyState>
        )}
        <ul className="plain-list">
          {recommendations.data?.recommendations.map((person) => (
            <li key={person.userId} className="card row between">
              <span>
                <strong>{person.displayName}</strong> <span className="muted">@{person.username}</span>
                <span className="badge badge-tag">{Math.round(person.score * 100)}% match</span>
              </span>
              <button type="button" className="btn btn-primary" onClick={() => act(() => api.connect(person.userId))}>
                Connect with {person.username}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mine-h">
        <h2 id="mine-h">Your network</h2>
        {connections.loading && !connections.data && <Loading />}
        {connections.error && <ErrorState message={connections.error} onRetry={connections.reload} />}
        {connections.data && connections.data.connections.length === 0 && <EmptyState title="No connections yet" />}
        <ul className="plain-list">
          {connections.data?.connections.map((connection) => (
            <li key={connection.userId} className="card row between">
              <span>
                <strong>{connection.displayName}</strong> <span className="muted">@{connection.username}</span>{' '}
                {connection.status !== 'accepted' && (
                  <span className="badge badge-tag">{connection.status === 'pending_incoming' ? 'Wants to connect' : 'Request sent'}</span>
                )}
                {connection.flag === 'yellow' && (
                  <span className="badge badge-yellow">
                    <span aria-hidden="true">!</span> Profiles no longer match
                  </span>
                )}
              </span>
              <span className="row">
                {connection.status === 'pending_incoming' && (
                  <button type="button" className="btn btn-primary" onClick={() => act(() => api.acceptConnection(connection.userId))}>
                    Accept {connection.username}
                  </button>
                )}
                <button type="button" className="btn" onClick={() => act(() => api.removeConnection(connection.userId))}>
                  Remove {connection.username}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
