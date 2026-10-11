# Recommender contract

The AI model is **not implemented**. The feed pipeline calls a single function and a deterministic fallback is used
until a model adapter is registered.

```ts
// apps/server/src/recommender
recommend(userId: string, candidates: FeedCandidate[], context: RecommendContext, options?: { onError?(e: unknown): void }): Promise<RankedItem[]>
setRecommenderAdapter(adapter: RecommenderAdapter): void   // the model hook
interface RecommenderAdapter { readonly name: string; rank(userId, candidates, context): Promise<RankedItem[]> }
```

Types (`FeedCandidate`, `RecommendContext`, `RankedItem`) are in `recommender/types.ts`.

- **Input**: `candidates` are posts already filtered by the feed pipeline (top-level, not red, last 30 days, at most 200,
  not from blocked authors, audience rules applied), each with features (engagement counts, flag/tags, connection and similarity).
  `context` carries `now`, `limit` and `requestId`.
- **Output**: `{ id, score, reason }` per post, best first (higher score is better).
- **Guarantees from `recommend()`**: it never throws. Adapter output is sanitised (unknown/duplicate ids and non-finite scores dropped,
  omitted candidates appended chronologically); any adapter error triggers `onError` and falls back to chronological order.
- **Default adapter**: `chronological` (newest first).
- Sketch endpoints `Recommend/<userId>`, `UpdateFeed/<userId>`, `UpdateUserProfile/<userId>` map to `GET /feed`,
  `POST /feed/refresh` and the profile-update hook. See Q3 in [QUESTIONS.md](QUESTIONS.md).
