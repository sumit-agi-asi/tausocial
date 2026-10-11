import { Flag } from '../types';

const LABELS: Record<Flag, string> = {
  green: 'Safe',
  yellow: 'Caution: possibly fake or altered',
  red: 'Unsafe'
};

const TAG_LABELS: Record<string, string> = {
  vulgar: 'Vulgar',
  abuse: 'Abuse',
  unsafe: 'Unsafe',
  fake_news: 'Fake news',
  ai_generated: 'AI created',
  morphed: 'Morphed',
  altered: 'Altered',
  edited: 'Edited',
  movie_clip: 'Movie clip',
  existing_audio: 'Existing audio',
  recorded_video: 'Recorded video'
};

/** Colour is never the only signal: every flag carries an icon and a text label. */
export function FlagBadge({ flag, tags }: { flag: Flag; tags: string[] }) {
  const icon = flag === 'green' ? '✓' : flag === 'yellow' ? '!' : '✕';
  return (
    <span className="flag-group">
      <span className={`badge badge-${flag}`} title="Monitored and tagged by TauSocial intelligence">
        <span aria-hidden="true">{icon}</span> {LABELS[flag]}
      </span>
      {tags.map((tag) => (
        <span key={tag} className="badge badge-tag">
          {TAG_LABELS[tag] ?? tag}
        </span>
      ))}
    </span>
  );
}
