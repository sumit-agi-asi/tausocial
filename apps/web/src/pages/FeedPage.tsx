import { Link } from 'react-router-dom';
import { api } from '../api';
import { Composer } from '../components/Composer';
import { EmptyState, ErrorState, Loading } from '../components/Notice';
import { PostCard } from '../components/PostCard';
import { useAsync } from '../hooks';
import { FeedItem, Post } from '../types';
import { useState } from 'react';

export function FeedPage() {
  const feed = useAsync(() => api.feed(), []);
  const bubbles = useAsync(() => api.bubbles(), []);
  const [overrides, setOverrides] = useState<Record<string, Post>>({});
  const [removed, setRemoved] = useState<string[]>([]);

  const refresh = () => {
    setOverrides({});
    setRemoved([]);
    feed.reload();
    bubbles.reload();
  };

  const items: FeedItem[] = (feed.data?.items ?? [])
    .filter((item) => !removed.includes(item.id))
    .map((item) => ({ ...item, ...(overrides[item.id] ?? {}) }));

  return (
    <>
      <h1>Your feed</h1>
      {bubbles.data && bubbles.data.bubbles.length > 0 && (
        <nav aria-label="Recent posts from connections" className="bubbles">
          <ul>
            {bubbles.data.bubbles.map((bubble) => (
              <li key={bubble.userId}>
                <Link to={`/thread/${bubble.latestPostId}`} className="bubble" aria-label={`Recent post by ${bubble.username}`}>
                  <span className="avatar" aria-hidden="true">
                    {bubble.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="small">@{bubble.username}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Composer onCreated={refresh} />
      <div className="row between">
        <h2>Recommended for you</h2>
        <button type="button" className="btn" onClick={() => api.refreshFeed().then(() => refresh(), () => refresh())}>
          Refresh feed
        </button>
      </div>
      <div aria-live="polite">
        {feed.loading && !feed.data && <Loading label="Loading your feed" />}
        {feed.error && <ErrorState message={feed.error} onRetry={feed.reload} />}
        {feed.data && items.length === 0 && (
          <EmptyState title="Nothing here yet">
            Share your first post, or <Link to="/connections">find people to connect with</Link>.
          </EmptyState>
        )}
      </div>
      {items.map((item) => (
        <PostCard
          key={item.id}
          post={item}
          onChange={(post) => setOverrides((previous) => ({ ...previous, [post.id]: post }))}
          onDeleted={(id) => setRemoved((previous) => [...previous, id])}
        />
      ))}
    </>
  );
}
