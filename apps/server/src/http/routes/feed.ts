import { RequestHandler, Router } from 'express';
import { ageBand, ageOn } from '../../domain/age';
import { toSimilarityProfile } from '../../domain/connections';
import { POST_SELECT, PostRow, UserRow, USER_COLUMNS, iso, toPost } from '../../domain/mappers';
import { getRecommenderAdapter, recommend, FeedCandidate } from '../../recommender';
import { currentUserId } from '../auth';
import { AppContext } from '../context';
import { FeedQuery } from '../schemas';

const CANDIDATE_LIMIT = 200;
const CANDIDATE_WINDOW_DAYS = 30;

interface CandidateRow {
  id: string;
  author_id: string;
  created_at: Date | string;
  flag: 'green' | 'yellow' | 'red';
  tags: string[];
  upvotes: number;
  downvotes: number;
  reply_count: number;
  is_connection: boolean;
}

export function feedRoutes(ctx: AppContext, auth: RequestHandler): Router {
  const router = Router();
  router.use(auth);

  /**
   * Feed pipeline: 1) gather candidates 2) apply visibility rules 3) rank through recommend() 4) hydrate.
   */
  async function buildFeed(userId: string, limit: number, requestId?: string) {
    const { rows: meRows } = await ctx.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
    const me = meRows[0] as UserRow;
    const viewerBand = ageBand(ageOn(me.birth_date));
    const includeConnections = me.preferences.showConnectionPostsInFeed;

    const { rows } = await ctx.db.query<CandidateRow>(
      `SELECT p.id, p.author_id, p.created_at, p.flag, p.tags,
         (SELECT count(*)::int FROM reactions r WHERE r.post_id = p.id AND r.kind = 'up') AS upvotes,
         (SELECT count(*)::int FROM reactions r WHERE r.post_id = p.id AND r.kind = 'down') AS downvotes,
         (SELECT count(*)::int FROM posts c WHERE c.parent_id = p.id) AS reply_count,
         EXISTS (SELECT 1 FROM connections c WHERE c.status = 'accepted'
                   AND ((c.requester_id = $1 AND c.addressee_id = p.author_id)
                     OR (c.addressee_id = $1 AND c.requester_id = p.author_id))) AS is_connection
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.parent_id IS NULL AND p.flag <> 'red' AND u.status = 'active'
         AND p.created_at > now() - ($2 || ' days')::interval
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = p.author_id)
                                                   OR (b.blocker_id = p.author_id AND b.blocked_id = $1))
       ORDER BY p.created_at DESC LIMIT ${CANDIDATE_LIMIT}`,
      [userId, String(CANDIDATE_WINDOW_DAYS)]
    );

    const visible = rows.filter(
      (row) =>
        (row.author_id === userId || includeConnections || !row.is_connection) &&
        ctx.audience.canView(viewerBand, row.flag, row.tags)
    );

    const authorIds = [...new Set(visible.map((row) => row.author_id).filter((id) => id !== userId))];
    const similarity = new Map<string, number>();
    if (authorIds.length > 0) {
      const { rows: authors } = await ctx.db.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users WHERE id = ANY($1::text[])`,
        [authorIds]
      );
      const mine = toSimilarityProfile(me);
      for (const author of authors) {
        similarity.set(author.id, ctx.similarity.score(mine, toSimilarityProfile(author)));
      }
    }

    const candidates: FeedCandidate[] = visible.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      createdAt: iso(row.created_at) as string,
      flag: row.flag,
      tags: row.tags,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      replyCount: row.reply_count,
      authorIsConnection: row.is_connection,
      authorSimilarity: similarity.get(row.author_id)
    }));

    const ranked = (
      await recommend(userId, candidates, { now: new Date(), limit, requestId }, {
        onError: (error) => ctx.logger.error({ err: error, requestId }, 'recommender failed; using chronological fallback')
      })
    ).slice(0, limit);

    if (ranked.length === 0) {
      return { items: [], recommender: getRecommenderAdapter().name };
    }
    const { rows: posts } = await ctx.db.query<PostRow>(`${POST_SELECT} WHERE p.id = ANY($2::text[])`, [
      userId,
      ranked.map((item) => item.id)
    ]);
    const byId = new Map(posts.map((post) => [post.id, post]));
    const items = ranked.flatMap((item) => {
      const post = byId.get(item.id);
      return post ? [{ ...toPost(post), rank: { score: item.score, reason: item.reason } }] : [];
    });
    return { items, recommender: getRecommenderAdapter().name };
  }

  router.get('/', async (req, res, next) => {
    try {
      const { limit } = FeedQuery.parse(req.query);
      res.json(await buildFeed(currentUserId(req), limit, String(req.id)));
    } catch (error) {
      next(error);
    }
  });

  /** Recomputes the feed on demand (e.g. after a profile delta). Same payload as GET /feed. */
  router.post('/refresh', async (req, res, next) => {
    try {
      const { limit } = FeedQuery.parse(req.query);
      res.json(await buildFeed(currentUserId(req), limit, String(req.id)));
    } catch (error) {
      next(error);
    }
  });

  /** Connections who posted recently, shown as bubbles instead of inline feed items. */
  router.get('/bubbles', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const { rows } = await ctx.db.query<{ user_id: string; username: string; post_id: string; created_at: Date }>(
        `SELECT DISTINCT ON (u.id) u.id AS user_id, u.username, p.id AS post_id, p.created_at
           FROM connections c
           JOIN users u ON u.id = CASE WHEN c.requester_id = $1 THEN c.addressee_id ELSE c.requester_id END
           JOIN posts p ON p.author_id = u.id AND p.parent_id IS NULL AND p.flag <> 'red'
          WHERE c.status = 'accepted' AND (c.requester_id = $1 OR c.addressee_id = $1)
            AND u.status = 'active' AND (u.privacy->>'showRecentBubbles')::boolean
            AND p.created_at > now() - interval '24 hours'
            AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                                                      OR (b.blocker_id = u.id AND b.blocked_id = $1))
          ORDER BY u.id, p.created_at DESC`,
        [userId]
      );
      const bubbles = rows
        .map((row) => ({
          userId: row.user_id,
          username: row.username,
          latestPostId: row.post_id,
          latestPostAt: iso(row.created_at) as string
        }))
        .sort((a, b) => (a.latestPostAt < b.latestPostAt ? 1 : -1));
      res.json({ bubbles });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
