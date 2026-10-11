import { chronologicalRecommender } from './chronological';
import { FeedCandidate, RankedItem, RecommendContext, RecommenderAdapter } from './types';

export * from './types';
export { chronologicalRecommender } from './chronological';

let activeAdapter: RecommenderAdapter = chronologicalRecommender;

/**
 * Registers the model-backed adapter. TODO(owner): the AI model is intentionally not implemented here;
 * plug it in by calling `setRecommenderAdapter(modelAdapter)` during server start-up.
 */
export function setRecommenderAdapter(adapter: RecommenderAdapter): void {
  activeAdapter = adapter;
}

export function getRecommenderAdapter(): RecommenderAdapter {
  return activeAdapter;
}

export interface RecommendOptions {
  onError?: (error: unknown) => void;
}

/**
 * Single feed-in function of the feed pipeline.
 * Always returns each supplied candidate at most once, ordered best-first, and never throws:
 * unknown ids returned by the adapter are dropped, candidates the adapter omitted are appended chronologically,
 * and any adapter failure falls back to chronological order.
 */
export async function recommend(
  userId: string,
  candidates: readonly FeedCandidate[],
  context: RecommendContext,
  options: RecommendOptions = {}
): Promise<RankedItem[]> {
  const known = new Set(candidates.map((candidate) => candidate.id));
  let ranked: RankedItem[];
  try {
    ranked = await activeAdapter.rank(userId, candidates, context);
  } catch (error) {
    options.onError?.(error);
    return chronologicalRecommender.rank(userId, candidates, context);
  }

  const seen = new Set<string>();
  const valid = ranked.filter((item) => {
    if (!known.has(item.id) || seen.has(item.id) || !Number.isFinite(item.score)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  valid.sort((a, b) => b.score - a.score);

  if (valid.length < known.size) {
    const rest = candidates.filter((candidate) => !seen.has(candidate.id));
    const fallback = await chronologicalRecommender.rank(userId, rest, context);
    const floor = (valid[valid.length - 1]?.score ?? 0) - 1;
    valid.push(...fallback.map((item, index) => ({ ...item, score: floor - index, reason: 'fallback-unranked' })));
  }
  return valid;
}
