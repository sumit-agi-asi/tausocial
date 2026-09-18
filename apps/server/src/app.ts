import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { JsonStorage } from './storage';
import { commentSchema, loginSchema, postSchema, registerSchema } from './validation';
import { hashPassword, issueToken, requireAuth, AuthenticatedRequest } from './auth';
import { buildAccountabilityMetrics, generateFeedInsights } from './insights';
import { scoreContent } from './moderation';
import { Comment, Post, User } from './models';

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  };
}

export function createApp(storage = new JsonStorage()): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/auth/register', async (req, res, next) => {
    try {
      const payload = registerSchema.parse(req.body);
      const data = await storage.read();

      if (data.users.some((user) => user.email.toLowerCase() === payload.email.toLowerCase())) {
        res.status(409).json({ message: 'Email already registered' });
        return;
      }

      const user: User = {
        id: createId('u'),
        username: payload.username,
        email: payload.email.toLowerCase(),
        passwordHash: hashPassword(payload.password),
        createdAt: new Date().toISOString()
      };

      data.users.push(user);
      await storage.write(data);

      const token = issueToken(user);
      res.status(201).json({ token, user: sanitizeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/auth/login', async (req, res, next) => {
    try {
      const payload = loginSchema.parse(req.body);
      const data = await storage.read();
      const user = data.users.find((candidate) => candidate.email === payload.email.toLowerCase());

      if (!user || user.passwordHash !== hashPassword(payload.password)) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
      }

      const token = issueToken(user);
      res.json({ token, user: sanitizeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/feed', requireAuth, async (_req: AuthenticatedRequest, res, next) => {
    try {
      const data = await storage.read();
      const sortedPosts = [...data.posts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      res.json({ posts: sortedPosts });
    } catch (error) {
      next(error);
    }
  });

  app.post('/feed/posts', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const auth = req.auth;
      if (!auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const payload = postSchema.parse(req.body);
      const data = await storage.read();
      const user = data.users.find((candidate) => candidate.id === auth.userId);

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      const post: Post = {
        id: createId('p'),
        userId: user.id,
        username: user.username,
        content: payload.content,
        createdAt: new Date().toISOString(),
        likes: [],
        comments: [],
        moderation: scoreContent(payload.content)
      };

      data.posts.push(post);
      await storage.write(data);
      res.status(201).json({ post });
    } catch (error) {
      next(error);
    }
  });

  app.post('/feed/posts/:postId/like', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const auth = req.auth;
      if (!auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const data = await storage.read();
      const post = data.posts.find((candidate) => candidate.id === req.params.postId);

      if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
      }

      if (!post.likes.includes(auth.userId)) {
        post.likes.push(auth.userId);
        await storage.write(data);
      }

      res.json({ post });
    } catch (error) {
      next(error);
    }
  });

  app.post('/feed/posts/:postId/comments', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const auth = req.auth;
      if (!auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const payload = commentSchema.parse(req.body);
      const data = await storage.read();

      const post = data.posts.find((candidate) => candidate.id === req.params.postId);
      const user = data.users.find((candidate) => candidate.id === auth.userId);

      if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
      }

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      const comment: Comment = {
        id: createId('c'),
        userId: user.id,
        username: user.username,
        content: payload.content,
        createdAt: new Date().toISOString()
      };

      post.comments.push(comment);
      await storage.write(data);
      res.status(201).json({ comment, post });
    } catch (error) {
      next(error);
    }
  });

  app.get('/metrics/accountability', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const auth = req.auth;
      if (!auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const data = await storage.read();
      res.json({ metrics: buildAccountabilityMetrics(data.posts, auth.userId) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/insights/feed', requireAuth, async (_req: AuthenticatedRequest, res, next) => {
    try {
      const data = await storage.read();
      res.json({ insights: generateFeedInsights(data.posts) });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    if (error && typeof error === 'object' && 'issues' in error) {
      res.status(400).json({ message: 'Validation error', issues: (error as { issues: unknown }).issues });
      return;
    }

    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}

export const app = createApp();
