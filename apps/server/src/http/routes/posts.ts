import { RequestHandler, Router } from 'express';
import crypto from 'node:crypto';
import { AppError, forbidden, notFound } from '../../errors';
import { POST_SELECT, PostRow, toPost } from '../../domain/mappers';
import { ModerationDecision } from '../../monitoring/types';
import { currentUserId } from '../auth';
import { AppContext } from '../context';
import { CreatePostRequest, ReactionRequest, ReportRequest, UpdatePostRequest } from '../schemas';

export function postRoutes(ctx: AppContext, auth: RequestHandler): Router {
  const router = Router();
  router.use(auth);

  const loadPost = async (id: string, viewerId: string): Promise<PostRow | undefined> =>
    (
      await ctx.db.query<PostRow>(
        `${POST_SELECT} WHERE p.id = $2
           AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = p.author_id)
                                                      OR (b.blocker_id = p.author_id AND b.blocked_id = $1))`,
        [viewerId, id]
      )
    ).rows[0];

  const rejectBlocked = (decision: ModerationDecision): AppError =>
    new AppError(422, 'content_blocked', 'This content violates community guidelines and was not published', {
      moderation: { flag: decision.flag, action: decision.action, tags: decision.tags }
    });

  router.post('/', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const input = CreatePostRequest.parse(req.body);
      if (input.parentId && !(await loadPost(input.parentId, userId))) {
        throw notFound('Parent post not found');
      }
      const decision = await ctx.moderation.moderate({ text: input.body, mediaUrls: input.media });
      if (decision.action === 'block') {
        throw rejectBlocked(decision);
      }
      const id = crypto.randomUUID();
      await ctx.db.query(
        `INSERT INTO posts (id, author_id, parent_id, body, media, tags, flag, action, moderation)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb)`,
        [
          id,
          userId,
          input.parentId ?? null,
          input.body,
          JSON.stringify(input.media),
          JSON.stringify(decision.tags),
          decision.flag,
          decision.action,
          JSON.stringify(decision.results)
        ]
      );
      res.status(201).json(toPost((await loadPost(id, userId)) as PostRow));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const post = await loadPost(String(req.params['id']), currentUserId(req));
      if (!post) throw notFound('Post not found');
      res.json(toPost(post));
    } catch (error) {
      next(error);
    }
  });

  /** Returns the post, its ancestors and all descendants (threads and sub-threads), oldest first. */
  router.get('/:id/thread', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const root = await loadPost(String(req.params['id']), userId);
      if (!root) throw notFound('Post not found');
      const { rows } = await ctx.db.query<PostRow>(
        `WITH RECURSIVE tree AS (
           SELECT id, 0 AS depth FROM posts WHERE id = $2
           UNION ALL
           SELECT c.id, t.depth + 1 FROM posts c JOIN tree t ON c.parent_id = t.id WHERE t.depth < 20
         )
         ${POST_SELECT} JOIN tree ON tree.id = p.id
         WHERE NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = p.author_id)
                                                     OR (b.blocker_id = p.author_id AND b.blocked_id = $1))
         ORDER BY p.created_at ASC, p.id ASC`,
        [userId, root.id]
      );
      res.json({ items: rows.map(toPost) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const id = String(req.params['id']);
      const input = UpdatePostRequest.parse(req.body);
      const post = await loadPost(id, userId);
      if (!post) throw notFound('Post not found');
      if (post.author_id !== userId) throw forbidden('Only the author can edit a post');
      const decision = await ctx.moderation.moderate({ text: input.body, mediaUrls: post.media });
      if (decision.action === 'block') {
        throw rejectBlocked(decision);
      }
      await ctx.db.query(
        `UPDATE posts SET body=$2, tags=$3::jsonb, flag=$4, action=$5, moderation=$6::jsonb, edited_at=now() WHERE id=$1`,
        [id, input.body, JSON.stringify(decision.tags), decision.flag, decision.action, JSON.stringify(decision.results)]
      );
      res.json(toPost((await loadPost(id, userId)) as PostRow));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const post = await loadPost(String(req.params['id']), userId);
      if (!post) throw notFound('Post not found');
      if (post.author_id !== userId && req.auth?.role !== 'moderator') {
        throw forbidden('Only the author or a moderator can delete a post');
      }
      await ctx.db.query('DELETE FROM posts WHERE id = $1', [post.id]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/reaction', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const { kind } = ReactionRequest.parse(req.body);
      const post = await loadPost(String(req.params['id']), userId);
      if (!post) throw notFound('Post not found');
      await ctx.db.query(
        `INSERT INTO reactions (post_id, user_id, kind) VALUES ($1,$2,$3)
         ON CONFLICT (post_id, user_id) DO UPDATE SET kind = EXCLUDED.kind`,
        [post.id, userId, kind]
      );
      res.json(toPost((await loadPost(post.id, userId)) as PostRow));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id/reaction', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const post = await loadPost(String(req.params['id']), userId);
      if (!post) throw notFound('Post not found');
      await ctx.db.query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2', [post.id, userId]);
      res.json(toPost((await loadPost(post.id, userId)) as PostRow));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/reports', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const { reason } = ReportRequest.parse(req.body);
      const post = await loadPost(String(req.params['id']), userId);
      if (!post) throw notFound('Post not found');
      await ctx.db.query(
        'INSERT INTO reports (id, post_id, reporter_id, reason) VALUES ($1,$2,$3,$4) ON CONFLICT (post_id, reporter_id) DO NOTHING',
        [crypto.randomUUID(), post.id, userId, reason]
      );
      res.status(202).json({ status: 'received' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
