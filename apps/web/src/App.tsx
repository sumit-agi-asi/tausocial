import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { AccountMetrics, FeedInsights, Post, SessionUser } from './types';
import './App.css';

type Mode = 'login' | 'register';

function badgeClass(label: Post['moderation']['label']): string {
  return `badge badge-${label}`;
}

function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('demo@tausocial.local');
  const [password, setPassword] = useState('demo1234');
  const [username, setUsername] = useState('');
  const [session, setSession] = useState<{ token: string; user: SessionUser } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<AccountMetrics | null>(null);
  const [insights, setInsights] = useState<FeedInsights | null>(null);
  const [postContent, setPostContent] = useState('');
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function refreshDashboard(token: string): Promise<void> {
    const [feed, metricsResult, insightsResult] = await Promise.all([
      api.feed(token),
      api.metrics(token),
      api.insights(token)
    ]);

    setPosts(feed.posts);
    setMetrics(metricsResult.metrics);
    setInsights(insightsResult.insights);
  }

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    refreshDashboard(session.token).catch((fetchError: Error) => {
      setError(fetchError.message);
    });
  }, [session?.token]);

  const summary = useMemo(() => {
    if (!insights) {
      return 'Loading moderation insights...';
    }
    return insights.summary;
  }, [insights]);

  async function onSubmitAuth(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      const result =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(username, email, password);

      setSession(result);
    } catch (authError) {
      setError((authError as Error).message);
    }
  }

  async function onCreatePost(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session?.token || postContent.trim().length < 3) {
      return;
    }

    await api.createPost(session.token, postContent.trim());
    setPostContent('');
    await refreshDashboard(session.token);
  }

  async function onLike(postId: string): Promise<void> {
    if (!session?.token) {
      return;
    }

    await api.likePost(session.token, postId);
    await refreshDashboard(session.token);
  }

  async function onComment(postId: string): Promise<void> {
    if (!session?.token) {
      return;
    }

    const content = commentDraft[postId]?.trim();
    if (!content) {
      return;
    }

    await api.commentPost(session.token, postId, content);
    setCommentDraft((previous) => ({ ...previous, [postId]: '' }));
    await refreshDashboard(session.token);
  }

  if (!session?.token) {
    return (
      <main className="shell">
        <section className="auth-card">
          <h1>TauSocial</h1>
          <p className="subhead">Build accountability in a safer social feed.</p>

          <div className="mode-toggle">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Login
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
              Register
            </button>
          </div>

          <form onSubmit={onSubmitAuth} className="auth-form">
            {mode === 'register' && (
              <label>
                Username
                <input value={username} onChange={(event) => setUsername(event.target.value)} required />
              </label>
            )}
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={6}
                required
              />
            </label>

            <button type="submit" className="primary">
              {mode === 'login' ? 'Enter dashboard' : 'Create account'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell dashboard">
      <header className="hero-card">
        <div>
          <p className="pill">Signed in as @{session.user.username}</p>
          <h2>Accountability Dashboard</h2>
          <p>{summary}</p>
        </div>
      </header>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Posts</span>
          <strong>{metrics?.authoredPosts ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Comments</span>
          <strong>{metrics?.commentsMade ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Likes Received</span>
          <strong>{metrics?.likesReceived ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Flagged</span>
          <strong>{metrics?.flaggedPosts ?? 0}</strong>
        </article>
      </section>

      <section className="create-card">
        <h3>Post to the feed</h3>
        <form onSubmit={onCreatePost}>
          <textarea
            placeholder="Share your progress update"
            value={postContent}
            onChange={(event) => setPostContent(event.target.value)}
            rows={3}
          />
          <button className="primary" type="submit">
            Publish
          </button>
        </form>
      </section>

      <section className="feed-list">
        {posts.map((post) => (
          <article key={post.id} className="post-card">
            <div className="post-head">
              <p>
                <strong>@{post.username}</strong>
              </p>
              <span className={badgeClass(post.moderation.label)}>{post.moderation.label.toUpperCase()}</span>
            </div>
            <p>{post.content}</p>
            <small>{post.moderation.summary}</small>

            <div className="actions">
              <button type="button" onClick={() => onLike(post.id)}>
                ❤️ {post.likes.length}
              </button>
            </div>

            <div className="comments">
              {post.comments.map((comment) => (
                <p key={comment.id} className="comment-line">
                  <strong>@{comment.username}</strong>: {comment.content}
                </p>
              ))}
              <div className="comment-form">
                <input
                  value={commentDraft[post.id] ?? ''}
                  onChange={(event) =>
                    setCommentDraft((previous) => ({
                      ...previous,
                      [post.id]: event.target.value
                    }))
                  }
                  placeholder="Comment"
                />
                <button type="button" onClick={() => onComment(post.id)}>
                  Add
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
