import { FormEvent, useId, useState } from 'react';
import { ApiError, api } from '../api';
import { Post } from '../types';
import { messageOf } from '../hooks';
import { Popup } from './Notice';

export const MAX_POST_LENGTH = 2000;

interface Props {
  parentId?: string;
  label?: string;
  submitLabel?: string;
  onCreated: (post: Post) => void;
}

export function Composer({ parentId, label = 'Share something', submitLabel = 'Post', onCreated }: Props) {
  const id = useId();
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | 'audio'>('image');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError('Write something first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const media = mediaUrl.trim() ? [{ kind: mediaKind, url: mediaUrl.trim() }] : [];
      const post = await api.createPost({ body: body.trim(), parentId, media });
      setBody('');
      setMediaUrl('');
      onCreated(post);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'content_blocked') {
        setBlocked(caught);
      } else {
        setError(messageOf(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card composer" onSubmit={submit}>
      <label htmlFor={`${id}-body`}>{label}</label>
      <textarea
        id={`${id}-body`}
        value={body}
        maxLength={MAX_POST_LENGTH}
        rows={parentId ? 2 : 3}
        onChange={(event) => setBody(event.target.value)}
        aria-describedby={`${id}-count`}
      />
      <p id={`${id}-count`} className="muted small">
        {body.length}/{MAX_POST_LENGTH}
      </p>
      {!parentId && (
        <div className="row">
          <div className="field">
            <label htmlFor={`${id}-kind`}>Media type</label>
            <select id={`${id}-kind`} value={mediaKind} onChange={(event) => setMediaKind(event.target.value as typeof mediaKind)}>
              <option value="image">Photo</option>
              <option value="video">Video</option>
              <option value="audio">Music / audio</option>
            </select>
          </div>
          <div className="field grow">
            <label htmlFor={`${id}-media`}>Media link (https, optional)</label>
            <input
              id={`${id}-media`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={mediaUrl}
              onChange={(event) => setMediaUrl(event.target.value)}
            />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Checking…' : submitLabel}
      </button>
      {blocked && (
        <Popup title="This post was not published" onClose={() => setBlocked(null)}>
          <p>Our monitoring flagged this content as unsafe{blocked.moderation?.tags.length ? ` (${blocked.moderation.tags.join(', ')})` : ''}.</p>
          <p>Please edit it and try again.</p>
        </Popup>
      )}
    </form>
  );
}
