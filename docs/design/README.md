# Design sources

Hand-drawn sketches that define the screens and features. The implementation follows them; where a sketch is
ambiguous the behaviour is isolated behind a TODO and listed in [QUESTIONS.md](../QUESTIONS.md).

| Photo | Content (as interpreted) |
| --- | --- |
| [PXL_20261011_073543133.MP.jpg](PXL_20261011_073543133.MP.jpg) | Login/sign-up, threaded feed, KYC (ID, phone, address proof), AI tagging colours, age groups, recommendations ≥ 0.80, settings, post menu, recent-post bubbles |
| [PXL_20261011_073558227.MP.jpg](PXL_20261011_073558227.MP.jpg) | τ logo, feed, thumbs up/down, hover popup, AI-created tags, media icons |
| [PXL_20261011_073609288.jpg](PXL_20261011_073609288.jpg) | Backend endpoints: recommender, monitoring analysers, profile creator/blocker/deleter |
| [PXL_20261011_073621486.MP.jpg](PXL_20261011_073621486.MP.jpg) | Profile similarity thresholds, yellow flag, multi-region/delta deploys, CI/CD approval |
| [PXL_20261011_073632841.MP.jpg](PXL_20261011_073632841.MP.jpg) | Tech stack sketch (blob storage, NoSQL/graph/Redis, AI models in blob, approval flow, session-only cache) |
| [PXL_20261011_073639603.MP.jpg](PXL_20261011_073639603.MP.jpg) | **Not reviewed** during implementation, see QUESTIONS.md |

## Mapping to the implementation

| Sketch | Implementation |
| --- | --- |
| Tag colours (red unsafe, yellow fake, green safe) | `monitoring/policy.ts`, `FlagBadge` |
| `AnalyseText`, `AbuseDetect`, `FakeNewsDetect`, `AnalyseVideo/Audio`, `DetectAI`, `CheckUserAuthenticity` | `monitoring/types.ts` interfaces, heuristic text analysers, `unknown` stubs for media; `POST /monitoring/*` |
| `Recommend/<userId>`, `UpdateFeed`, `UpdateUserProfile` | `recommend()`, `POST /feed/refresh`, rescoring on profile update |
| ProfileCreator / Blocker / Deleter | `POST /auth/register`, `PUT /profiles/{id}/block`, `DELETE /profiles/me`, `/admin/*` |
| Recent-post bubbles | `GET /feed/bubbles`, `showConnectionPostsInFeed` preference |
| Session-only local cache | session stored in `sessionStorage` |
