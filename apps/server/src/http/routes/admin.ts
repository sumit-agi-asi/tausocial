import { RequestHandler, Router } from 'express';
import { badRequest, notFound } from '../../errors';
import { currentUserId, requireModerator } from '../auth';
import { AppContext } from '../context';

/** Moderator-only operations ("ProfileBlocker" / "ProfileDeleter" in the design). */
export function adminRoutes(ctx: AppContext, auth: RequestHandler): Router {
  const router = Router();
  router.use(auth, requireModerator);

  router.post('/profiles/:id/block', async (req, res, next) => {
    try {
      const id = String(req.params['id']);
      if (id === currentUserId(req)) throw badRequest('You cannot block yourself');
      const result = await ctx.db.query("UPDATE users SET status = 'blocked', updated_at = now() WHERE id = $1", [id]);
      if (result.rowCount === 0) throw notFound('Profile not found');
      ctx.logger.warn({ moderatorId: currentUserId(req), targetId: id }, 'profile blocked by moderator');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post('/profiles/:id/unblock', async (req, res, next) => {
    try {
      const result = await ctx.db.query("UPDATE users SET status = 'active', updated_at = now() WHERE id = $1", [
        String(req.params['id'])
      ]);
      if (result.rowCount === 0) throw notFound('Profile not found');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete('/profiles/:id', async (req, res, next) => {
    try {
      const id = String(req.params['id']);
      if (id === currentUserId(req)) throw badRequest('Use DELETE /profiles/me to delete your own account');
      const result = await ctx.db.query('DELETE FROM users WHERE id = $1', [id]);
      if (result.rowCount === 0) throw notFound('Profile not found');
      ctx.logger.warn({ moderatorId: currentUserId(req), targetId: id }, 'profile deleted by moderator');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
