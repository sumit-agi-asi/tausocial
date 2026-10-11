import { RecommenderAdapter } from './types';

/** Deterministic fallback: newest first, ties broken by id. */
export const chronologicalRecommender: RecommenderAdapter = {
  name: 'chronological',
  async rank(_userId, candidates) {
    return [...candidates]
      .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? 1 : -1))
      .map((candidate, index) => ({ id: candidate.id, score: candidates.length - index, reason: 'chronological' }));
  }
};
