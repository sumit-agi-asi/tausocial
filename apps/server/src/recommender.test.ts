import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FeedCandidate,
  RecommenderAdapter,
  chronologicalRecommender,
  getRecommenderAdapter,
  recommend,
  setRecommenderAdapter
} from './recommender';

const candidate = (id: string, createdAt: string): FeedCandidate => ({
  id,
  authorId: 'a',
  createdAt,
  flag: 'green',
  tags: [],
  upvotes: 0,
  downvotes: 0,
  replyCount: 0,
  authorIsConnection: false
});

const candidates = [
  candidate('old', '2026-01-01T00:00:00Z'),
  candidate('new', '2026-03-01T00:00:00Z'),
  candidate('mid', '2026-02-01T00:00:00Z')
];
const context = { now: new Date('2026-04-01T00:00:00Z'), limit: 10 };

afterEach(() => setRecommenderAdapter(chronologicalRecommender));

describe('recommend()', () => {
  it('defaults to chronological order', async () => {
    const ranked = await recommend('u', candidates, context);
    expect(ranked.map((item) => item.id)).toEqual(['new', 'mid', 'old']);
    expect(getRecommenderAdapter().name).toBe('chronological');
  });

  it('handles an empty candidate list', async () => {
    expect(await recommend('u', [], context)).toEqual([]);
  });

  it('uses a registered adapter and sanitises its output', async () => {
    const adapter: RecommenderAdapter = {
      name: 'test-model',
      rank: async () => [
        { id: 'old', score: 10, reason: 'model' },
        { id: 'old', score: 99, reason: 'duplicate' },
        { id: 'ghost', score: 50, reason: 'unknown id' },
        { id: 'mid', score: Number.NaN, reason: 'nan' }
      ]
    };
    setRecommenderAdapter(adapter);
    const ranked = await recommend('u', candidates, context);
    expect(ranked.map((item) => item.id)).toEqual(['old', 'new', 'mid']);
    expect(ranked[0]?.reason).toBe('model');
    expect(ranked[1]?.reason).toBe('fallback-unranked');
  });

  it('falls back to chronological when the adapter throws', async () => {
    setRecommenderAdapter({ name: 'broken', rank: async () => Promise.reject(new Error('model down')) });
    const onError = vi.fn();
    const ranked = await recommend('u', candidates, context, { onError });
    expect(ranked.map((item) => item.id)).toEqual(['new', 'mid', 'old']);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('does not mutate the candidates', async () => {
    const copy = JSON.stringify(candidates);
    await recommend('u', candidates, context);
    expect(JSON.stringify(candidates)).toBe(copy);
  });
});
