import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { Composer } from '../components/Composer';
import { ErrorState, Loading } from '../components/Notice';
import { PostCard } from '../components/PostCard';
import { useAsync } from '../hooks';
import { Post } from '../types';

export function ThreadPage() {
  const { id = '' } = useParams();
  const thread = useAsync(() => api.thread(id), [id]);
  const [overrides, setOverrides] = useState<Record<string, Post>>({});
  const [removed, setRemoved] = useState<string[]>([]);

  if (thread.loading && !thread.data) return <Loading label="Loading thread" />;
  if (thread.error) return <ErrorState message={thread.error} onRetry={thread.reload} />;

  const posts = (thread.data?.items ?? []).filter((post) => !removed.includes(post.id)).map((post) => overrides[post.id] ?? post);
  const depth = new Map<string, number>();
  for (const post of posts) {
    depth.set(post.id, post.parentId && depth.has(post.parentId) ? Math.min(depth.get(post.parentId)! + 1, 4) : 0);
  }

  return (
    <>
      <p>
        <Link to="/feed">← Back to feed</Link>
      </p>
      <h1>Thread</h1>
      {posts.map((post) => (
        <div key={post.id} className={`thread-level thread-level-${depth.get(post.id)!}`}>
          <PostCard
            post={post}
            showThreadLink={false}
            onChange={(next) => setOverrides((previous) => ({ ...previous, [next.id]: next }))}
            onDeleted={(removedId) => setRemoved((previous) => [...previous, removedId])}
          />
        </div>
      ))}
      <Composer parentId={id} label="Reply to this thread" submitLabel="Reply" onCreated={thread.reload} />
    </>
  );
}
