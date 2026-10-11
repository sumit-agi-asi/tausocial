# ADR 0004: Recommender behind a single function and adapter
Status: accepted. `recommend(userId, candidates, context)` is the only entry point from the feed. Models plug in via `setRecommenderAdapter`; output is sanitised and errors fall back to chronological order. The model is out of scope. See docs/recommender.md.
