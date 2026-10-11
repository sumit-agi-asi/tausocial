# Questions for the owner

Each item is isolated behind an interface or a clearly marked TODO. Current behaviour is a documented placeholder.

| # | Question | Where in code | Current placeholder |
| --- | --- | --- | --- |
| Q1 | **Profile similarity**: exact definition, feature weights, and thresholds? The sketches show 0.80 (connect), 0.81 ok, <0.79 not ok, and a drop to 0.5 → yellow flag *before removal*. What exactly triggers removal and when? | `domain/similarity.ts`, `domain/connections.ts` | Jaccard-style overlap of interests/dislikes/profession/country/education; recommend at ≥ 0.8; drift marks yellow, never removes |
| Q2 | **Moderation rules**: what is red/yellow/green precisely, which content is blocked vs warned, is there an appeal flow, and who reviews reports? Is "accountability" a numeric score? | `monitoring/policy.ts` | violation → red + blocked (422), suspect → yellow, else green; no score |
| Q3 | **Recommender model**: inputs, features, hosting ("hashed binary" algorithm, models in blob storage), and training/update cadence (`UpdateFeed`, `UpdateUserProfile` on delta)? | `recommender/` | chronological fallback |
| Q4 | **AI analysers** (text, video, audio, AI-generated detection, fake news): vendor/model, hosting, latency budget, thresholds? | `monitoring/analyzers.ts` | keyword heuristics for text; media and `detectAI` return `unknown` |
| Q5 | **Age-group restrictions** (<14, <18, <40, >40): what is blocked or limited per group? Minimum signup age? | `domain/age.ts`, `domain/audience.ts` | minimum age 13 (`MIN_SIGNUP_AGE`); under-18 users never see content tagged adult-only (no such tag yet) |
| Q6 | **KYC**: authenticity checks (`CheckUserAuthenticity`), document upload/storage, reviewer workflow, retention, which verification gates which features? | `http/routes/profiles.ts`, `VerifyPage` | users submit document *references*; moderators approve manually; nothing is gated |
| Q7 | Should connections' posts be hidden from the main feed by default (sketch implies "not shown by default")? | `feed` route | hidden by default, preference to show |
| Q8 | Custom "Tau" typeface (sharp twin glyphs) and brand assets: provide files? Bootstrap was sketched; custom CSS was used (ADR 0006). | `apps/web/src/styles.css` | system font stack, τ logo mark |
| Q9 | Data stores: the sketch lists NoSQL, Graph and Redis. PostgreSQL only was used (ADR 0002). Is a split required? Multi-region and delta deployments? | `infrastructure/` | single region, Postgres |
| Q10 | Power-Flow-style **manual approval** for releases: GitHub environment approval was used. Acceptable? | `.github/workflows/deploy.yml` | GitHub environment reviewers |
| Q11 | **Design photos**: the brief lists 7 photos but only 6 exist in the repo, and `PXL_20261011_073639603.MP.jpg` could not be reviewed. Please confirm nothing is missing and describe that photo. | `docs/design/` | not reflected |
| Q12 | Production **values**: domain, SKUs, regions, tenant, subscription, retention periods, legal/privacy copy (ToS, data deletion SLA). | `infrastructure/parameters` | `<…_PLACEHOLDER>` values |
