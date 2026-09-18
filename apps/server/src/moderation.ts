import { ModerationResult } from './models';

const flaggedTerms = ['kill', 'hate', 'fraud', 'scam'];
const watchTerms = ['angry', 'fight', 'stupid', 'idiot'];

function includesTerm(content: string, term: string): boolean {
  return content.toLowerCase().includes(term);
}

export function scoreContent(content: string): ModerationResult {
  const normalized = content.trim();
  const lower = normalized.toLowerCase();

  const flaggedHits = flaggedTerms.filter((term) => includesTerm(lower, term));
  const watchHits = watchTerms.filter((term) => includesTerm(lower, term));

  const score = Math.max(0, Math.min(100, 20 + flaggedHits.length * 35 + watchHits.length * 20));

  const label: ModerationResult['label'] = flaggedHits.length
    ? 'flagged'
    : watchHits.length
      ? 'watch'
      : 'safe';

  const highlights = [...flaggedHits, ...watchHits];

  const summary =
    label === 'safe'
      ? 'Content looks safe for the community feed.'
      : label === 'watch'
        ? 'Tone requires monitoring for accountability and civility.'
        : 'Content was flagged for high-risk language and should be reviewed.';

  return { label, score, highlights, summary };
}
