import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api';
import { messageOf } from '../hooks';
import { Post } from '../types';
import { useAuth } from '../auth';
import { FlagBadge } from './FlagBadge';
import { Popup } from './Notice';

interface Props {
  post: Post;
  onChange: (post: Post) => void;
  onDeleted: (id: string) => void;
  showThreadLink?: boolean;
}

export function PostCard({ post, onChange, onDeleted, showThreadLink = true }: Props) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = user?.id === post.authorId;

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'content_blocked') {
        setNotice({ title: 'Edit not saved', message: 'Monitoring flagged the edited text as unsafe.' });
      } else {
        setError(messageOf(caught));
      }
    }
  }

  const react = (kind: 'up' | 'down') =>
    run(async () => onChange(post.myReaction === kind ? await api.unreact(post.id) : await api.react(post.id, kind)));

  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      onChange(await api.editPost(post.id, draft));
      setEditing(false);
    });
  }

  async function copy() {
    setMenuOpen(false);
    const link = `${window.location.origin}/thread/${post.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice({ title: 'Copied', message: 'Link copied to the clipboard.' });
    } catch {
      setNotice({ title: 'Copy failed', message: link });
    }
  }

  const remove = () =>
    run(async () => {
      setMenuOpen(false);
      await api.deletePost(post.id);
      onDeleted(post.id);
    });

  const report = () =>
    run(async () => {
      setMenuOpen(false);
      await api.report(post.id, 'abuse');
      setNotice({ title: 'Report received', message: 'Thanks. Our moderators will review this post.' });
    });

  return (
    <article className={`card post post-${post.flag}`} aria-label={`Post by ${post.authorUsername}`}>
      <header className="post-head">
        <Link to={`/profile/${post.authorId}`} className="author" title={`Hi, I'm ${post.authorDisplayName}`}>
          <span className="avatar" aria-hidden="true">
            {post.authorUsername.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{post.authorDisplayName}</strong> <span className="muted">@{post.authorUsername}</span>
          </span>
        </Link>
        <time className="muted small" dateTime={post.createdAt}>
          {new Date(post.createdAt).toLocaleString()}
          {post.editedAt ? ' (edited)' : ''}
        </time>
        <div className="menu">
          <button
            type="button"
            className="btn btn-icon"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Post actions"
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {menuOpen && (
            <ul role="menu" className="menu-list">
              <li role="none">
                <button role="menuitem" type="button" onClick={copy}>
                  Copy link
                </button>
              </li>
              {mine && (
                <>
                  <li role="none">
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditing(true);
                      }}
                    >
                      Edit
                    </button>
                  </li>
                  <li role="none">
                    <button role="menuitem" type="button" onClick={remove}>
                      Delete
                    </button>
                  </li>
                </>
              )}
              {!mine && (
                <li role="none">
                  <button role="menuitem" type="button" onClick={report}>
                    Report
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </header>

      <FlagBadge flag={post.flag} tags={post.tags} />

      {editing ? (
        <form onSubmit={save} className="edit-form">
          <label htmlFor={`edit-${post.id}`}>Edit post</label>
          <textarea id={`edit-${post.id}`} value={draft} maxLength={2000} rows={3} onChange={(event) => setDraft(event.target.value)} />
          <div className="row">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="post-body">{post.body}</p>
      )}

      {post.media.map((item) =>
        item.kind === 'image' ? (
          <img key={item.url} src={item.url} alt="Attached by the author" className="media" loading="lazy" />
        ) : item.kind === 'video' ? (
          <video key={item.url} src={item.url} controls className="media" aria-label="Attached video" />
        ) : (
          <audio key={item.url} src={item.url} controls aria-label="Attached audio" />
        )
      )}

      <footer className="post-actions">
        <button
          type="button"
          className="btn"
          aria-pressed={post.myReaction === 'up'}
          aria-label={`Thumbs up, ${post.upvotes}`}
          onClick={() => react('up')}
        >
          👍 {post.upvotes}
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={post.myReaction === 'down'}
          aria-label={`Thumbs down, ${post.downvotes}`}
          onClick={() => react('down')}
        >
          👎 {post.downvotes}
        </button>
        {showThreadLink && (
          <Link className="btn" to={`/thread/${post.id}`}>
            💬 {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
          </Link>
        )}
      </footer>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {notice && (
        <Popup title={notice.title} onClose={() => setNotice(null)}>
          <p>{notice.message}</p>
        </Popup>
      )}
    </article>
  );
}
