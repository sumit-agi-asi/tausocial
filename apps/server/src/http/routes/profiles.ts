import { RequestHandler, Router } from 'express';
import crypto from 'node:crypto';
import { badRequest, forbidden, notFound, unauthorized } from '../../errors';
import { rescoreConnections } from '../../domain/connections';
import { iso, toMyProfile, toPublicProfile, USER_COLUMNS, UserRow } from '../../domain/mappers';
import { currentUserId, verifyPassword } from '../auth';
import { AppContext } from '../context';
import { DeleteAccountRequest, UpdateProfileRequest, VerificationRequest } from '../schemas';

export function profileRoutes(ctx: AppContext, auth: RequestHandler): Router {
  const router = Router();
  router.use(auth);

  const loadUser = async (id: string): Promise<UserRow | undefined> =>
    (await ctx.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id])).rows[0];

  const isBlockedBetween = async (a: string, b: string): Promise<boolean> =>
    (
      await ctx.db.query(
        'SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
        [a, b]
      )
    ).rowCount > 0;

  router.get('/me', async (req, res, next) => {
    try {
      const user = await loadUser(currentUserId(req));
      if (!user) throw unauthorized();
      res.json(toMyProfile(user));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/me', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const patch = UpdateProfileRequest.parse(req.body);
      const current = await loadUser(userId);
      if (!current) throw unauthorized();

      const next_ = {
        display_name: patch.displayName ?? current.display_name,
        bio: patch.bio ?? current.bio,
        country: patch.country === undefined ? current.country : patch.country,
        education: patch.education === undefined ? current.education : patch.education,
        profession: patch.profession === undefined ? current.profession : patch.profession,
        interests: patch.interests ?? current.interests,
        dislikes: patch.dislikes ?? current.dislikes,
        privacy: patch.privacy ?? current.privacy,
        preferences: patch.preferences ?? current.preferences
      };
      await ctx.db.query(
        `UPDATE users SET display_name=$2, bio=$3, country=$4, education=$5, profession=$6,
           interests=$7::jsonb, dislikes=$8::jsonb, privacy=$9::jsonb, preferences=$10::jsonb, updated_at=now()
         WHERE id=$1`,
        [
          userId,
          next_.display_name,
          next_.bio,
          next_.country,
          next_.education,
          next_.profession,
          JSON.stringify(next_.interests),
          JSON.stringify(next_.dislikes),
          JSON.stringify(next_.privacy),
          JSON.stringify(next_.preferences)
        ]
      );
      await rescoreConnections(ctx.db, ctx.similarity, userId, ctx.config.similarityThreshold);
      const updated = await loadUser(userId);
      res.json(toMyProfile(updated as UserRow));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/me', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const { password } = DeleteAccountRequest.parse(req.body);
      const user = await loadUser(userId);
      if (!user) throw unauthorized();
      if (!verifyPassword(password, user.password_hash)) {
        throw forbidden('Password confirmation failed');
      }
      // Permanent deletion (no hibernation): all dependent rows are removed via ON DELETE CASCADE.
      await ctx.db.query('DELETE FROM users WHERE id = $1', [userId]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post('/me/verification', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const input = VerificationRequest.parse(req.body);
      const id = crypto.randomUUID();
      // Only opaque document references are stored; the documents live in private blob storage.
      // TODO(owner): authenticity checking / manual review workflow is undefined (docs/QUESTIONS.md Q6).
      const created = await ctx.db.tx(async (tx) => {
        await tx.query('INSERT INTO verifications (id, user_id, phone, gov_id_ref, address_proof_ref) VALUES ($1,$2,$3,$4,$5)', [
          id,
          userId,
          input.phone,
          input.govIdRef,
          input.addressProofRef
        ]);
        await tx.query("UPDATE users SET phone = $2, verification_status = 'pending', updated_at = now() WHERE id = $1", [
          userId,
          input.phone
        ]);
        return (await tx.query<{ created_at: Date }>('SELECT created_at FROM verifications WHERE id = $1', [id])).rows[0];
      });
      res.status(202).json({ id, status: 'pending', createdAt: iso(created?.created_at ?? new Date()) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me/blocks', async (req, res, next) => {
    try {
      const { rows } = await ctx.db.query<{ id: string; username: string }>(
        'SELECT u.id, u.username FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1 ORDER BY b.created_at DESC',
        [currentUserId(req)]
      );
      res.json({ blocks: rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const viewerId = currentUserId(req);
      const id = String(req.params['id']);
      const user = await loadUser(id);
      if (!user || user.status === 'blocked' || (id !== viewerId && (await isBlockedBetween(viewerId, id)))) {
        throw notFound('Profile not found');
      }
      if (id !== viewerId && user.privacy.profileVisibility === 'connections') {
        const connected = await ctx.db.query(
          `SELECT 1 FROM connections WHERE status = 'accepted'
             AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
          [viewerId, id]
        );
        if (connected.rowCount === 0) {
          throw forbidden('This profile is only visible to connections');
        }
      }
      res.json(toPublicProfile(user));
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/block', async (req, res, next) => {
    try {
      const viewerId = currentUserId(req);
      const id = String(req.params['id']);
      if (id === viewerId) throw badRequest('You cannot block yourself');
      if (!(await loadUser(id))) throw notFound('Profile not found');
      await ctx.db.tx(async (tx) => {
        await tx.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [viewerId, id]);
        await tx.query(
          'DELETE FROM connections WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)',
          [viewerId, id]
        );
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id/block', async (req, res, next) => {
    try {
      await ctx.db.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [
        currentUserId(req),
        String(req.params['id'])
      ]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
