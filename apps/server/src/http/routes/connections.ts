import { RequestHandler, Router } from 'express';
import { badRequest, conflict, notFound } from '../../errors';
import { toSimilarityProfile } from '../../domain/connections';
import { UserRow, USER_COLUMNS } from '../../domain/mappers';
import { currentUserId } from '../auth';
import { AppContext } from '../context';
import { ConnectionRequest } from '../schemas';

const RECOMMENDATION_POOL = 500;
const RECOMMENDATION_LIMIT = 20;

export function connectionRoutes(ctx: AppContext, auth: RequestHandler): Router {
  const router = Router();
  router.use(auth);

  const loadUser = async (id: string): Promise<UserRow | undefined> =>
    (await ctx.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND status = 'active'`, [id])).rows[0];

  const blocked = async (a: string, b: string): Promise<boolean> =>
    (
      await ctx.db.query(
        'SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
        [a, b]
      )
    ).rowCount > 0;

  router.get('/', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const { rows } = await ctx.db.query<{
        user_id: string;
        username: string;
        display_name: string;
        status: 'pending' | 'accepted';
        outgoing: boolean;
        score: number | null;
        flag: 'none' | 'yellow';
      }>(
        `SELECT u.id AS user_id, u.username, u.display_name, c.status, (c.requester_id = $1) AS outgoing, c.score, c.flag
           FROM connections c
           JOIN users u ON u.id = CASE WHEN c.requester_id = $1 THEN c.addressee_id ELSE c.requester_id END
          WHERE (c.requester_id = $1 OR c.addressee_id = $1) AND u.status = 'active'
          ORDER BY c.created_at DESC`,
        [userId]
      );
      res.json({
        connections: rows.map((row) => ({
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name || row.username,
          status: row.status === 'accepted' ? 'accepted' : row.outgoing ? 'pending_outgoing' : 'pending_incoming',
          score: row.score,
          flag: row.flag
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const { userId: targetId } = ConnectionRequest.parse(req.body);
      if (targetId === userId) throw badRequest('You cannot connect with yourself');
      if (!(await loadUser(targetId)) || (await blocked(userId, targetId))) throw notFound('Profile not found');
      const existing = await ctx.db.query(
        'SELECT 1 FROM connections WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)',
        [userId, targetId]
      );
      if (existing.rowCount > 0) throw conflict('A connection or request already exists');
      await ctx.db.query('INSERT INTO connections (requester_id, addressee_id) VALUES ($1,$2)', [userId, targetId]);
      res.status(201).json({ userId: targetId, status: 'pending_outgoing' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:userId/accept', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const requesterId = String(req.params['userId']);
      const [me, other] = await Promise.all([loadUser(userId), loadUser(requesterId)]);
      const pending = await ctx.db.query(
        "SELECT 1 FROM connections WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'",
        [requesterId, userId]
      );
      if (!me || !other || pending.rowCount === 0) throw notFound('Connection request not found');
      const score = ctx.similarity.score(toSimilarityProfile(me), toSimilarityProfile(other));
      await ctx.db.query(
        "UPDATE connections SET status = 'accepted', score = $3 WHERE requester_id = $1 AND addressee_id = $2",
        [requesterId, userId, score]
      );
      res.json({ userId: requesterId, status: 'accepted', score });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:userId', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const otherId = String(req.params['userId']);
      const result = await ctx.db.query(
        'DELETE FROM connections WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)',
        [userId, otherId]
      );
      if (result.rowCount === 0) throw notFound('Connection not found');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /** People whose profile similarity with the caller reaches the configured threshold. */
  router.get('/recommendations', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const me = await loadUser(userId);
      if (!me) throw notFound('Profile not found');
      const { rows } = await ctx.db.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users u
          WHERE u.id <> $1 AND u.status = 'active'
            AND NOT EXISTS (SELECT 1 FROM connections c
                             WHERE (c.requester_id = $1 AND c.addressee_id = u.id) OR (c.addressee_id = $1 AND c.requester_id = u.id))
            AND NOT EXISTS (SELECT 1 FROM blocks b
                             WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))
          ORDER BY u.created_at DESC LIMIT ${RECOMMENDATION_POOL}`,
        [userId]
      );
      const mine = toSimilarityProfile(me);
      const recommendations = rows
        .map((row) => ({
          userId: row.id,
          username: row.username,
          displayName: row.display_name || row.username,
          score: ctx.similarity.score(mine, toSimilarityProfile(row))
        }))
        .filter((item) => item.score >= ctx.config.similarityThreshold)
        .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
        .slice(0, RECOMMENDATION_LIMIT);
      res.json({ recommendations, threshold: ctx.config.similarityThreshold });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
