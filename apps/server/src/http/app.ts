import cors from 'cors';
import crypto from 'node:crypto';
import express, { ErrorRequestHandler, Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';
import { Config } from '../config';
import { Db } from '../db';
import { permissiveAudiencePolicy } from '../domain/audience';
import { defaultSimilarityScorer } from '../domain/similarity';
import { AppError } from '../errors';
import { Logger } from '../logger';
import { ModerationService } from '../monitoring/service';
import { TokenService, requireAuth } from './auth';
import { AppContext } from './context';
import { buildOpenApiDocument } from './openapi';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { connectionRoutes } from './routes/connections';
import { feedRoutes } from './routes/feed';
import { monitoringRoutes } from './routes/monitoring';
import { postRoutes } from './routes/posts';
import { profileRoutes } from './routes/profiles';

export interface AppDependencies {
  config: Config;
  db: Db;
  logger: Logger;
  moderation?: ModerationService;
  ready?: () => boolean;
}

export const onError: ErrorRequestHandler = (error, req, res, next) => {
  void next;
  const requestId = String(req.id);
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        requestId
      }
    });
    return;
  }
  if (error instanceof AppError) {
    const { moderation, ...details } = (error.details ?? {}) as { moderation?: unknown };
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(Object.keys(details).length ? { details } : {}),
        requestId
      },
      ...(moderation ? { moderation } : {})
    });
    return;
  }
  const type = (error as { type?: string }).type;
  if (type === 'entity.parse.failed' || type === 'entity.too.large') {
    const status = type === 'entity.too.large' ? 413 : 400;
    res.status(status).json({ error: { code: 'bad_request', message: 'Invalid request body', requestId } });
    return;
  }
  req.log.error({ err: error }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error', requestId } });
};

export function createApp(deps: AppDependencies): Express {
  const { config, db, logger } = deps;
  const ctx: AppContext = {
    config,
    db,
    logger,
    tokens: new TokenService(config.jwtSecret, config.jwtTtlSeconds),
    moderation: deps.moderation ?? new ModerationService(),
    similarity: defaultSimilarityScorer,
    audience: permissiveAudiencePolicy
  };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url.startsWith('/health') }
    })
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients send no Origin header; browsers must be on the allow-list.
        callback(null, !origin || config.corsOrigins.includes(origin));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      maxAge: 600
    })
  );

  /* ---------- Health ---------- */
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/health/ready', async (_req, res) => {
    if (deps.ready && !deps.ready()) {
      res.status(503).json({ status: 'shutting_down' });
      return;
    }
    try {
      await db.ping();
      res.json({ status: 'ready', checks: { database: 'ok' } });
    } catch (error) {
      logger.error({ err: error }, 'readiness check failed');
      res.status(503).json({ status: 'unavailable', checks: { database: 'failed' } });
    }
  });

  /* ---------- API ---------- */
  const limiterOptions = { windowMs: config.rateLimit.windowMs, standardHeaders: true, legacyHeaders: false } as const;
  const rateLimitMessage = { error: { code: 'rate_limited', message: 'Too many requests, please try again later.' } };
  const globalLimiter = rateLimit({ ...limiterOptions, limit: config.rateLimit.max, message: rateLimitMessage });
  const authLimiter = rateLimit({ ...limiterOptions, limit: config.rateLimit.authMax, message: rateLimitMessage });

  const openApi = buildOpenApiDocument();
  const api = express.Router();
  api.use(globalLimiter);
  api.use(express.json({ limit: '100kb' }));
  api.get('/openapi.json', (_req, res) => {
    res.json(openApi);
  });

  const auth: RequestHandler = requireAuth(ctx.tokens, db);
  api.use('/auth', authRoutes(ctx, authLimiter));
  api.use('/profiles', profileRoutes(ctx, auth));
  api.use('/posts', postRoutes(ctx, auth));
  api.use('/feed', feedRoutes(ctx, auth));
  api.use('/connections', connectionRoutes(ctx, auth));
  api.use('/monitoring', monitoringRoutes(ctx, auth));
  api.use('/admin', adminRoutes(ctx, auth));
  api.use((_req, _res, next) => next(new AppError(404, 'not_found', 'Route not found')));

  app.use('/api/v1', api);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApi));

  app.use((_req, _res, next) => next(new AppError(404, 'not_found', 'Route not found')));

  app.use(onError);

  return app;
}
