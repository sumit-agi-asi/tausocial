import { ModerationFlag } from '../monitoring/types';

/** A post eligible for the viewer's feed, enriched with features a ranking model may use. */
export interface FeedCandidate {
  id: string;
  authorId: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  flag: ModerationFlag;
  tags: string[];
  upvotes: number;
  downvotes: number;
  replyCount: number;
  /** Viewer has an accepted connection with the author. */
  authorIsConnection: boolean;
  /** Profile similarity between viewer and author in [0,1], when known. */
  authorSimilarity?: number;
}

export interface RecommendContext {
  now: Date;
  /** Maximum number of items the caller will display. */
  limit: number;
  requestId?: string;
}

export interface RankedItem {
  id: string;
  /** Higher is better. Only relative order matters. */
  score: number;
  /** Short machine-readable explanation, e.g. "chronological". */
  reason: string;
}

/**
 * Adapter implemented by the (future) AI model. See docs/recommender.md for the full contract.
 * Implementations must not mutate `candidates` and must only return ids that were supplied.
 */
export interface RecommenderAdapter {
  readonly name: string;
  rank(userId: string, candidates: readonly FeedCandidate[], context: RecommendContext): Promise<RankedItem[]>;
}
