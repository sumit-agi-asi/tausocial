import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Db } from '../db';
import { forbidden, unauthorized } from '../errors';

export interface AuthContext {
  userId: string;
  role: 'user' | 'moderator';
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, storedHash] = encoded.split(':');
  if (!salt || !storedHash) {
    return false;
  }
  const left = crypto.scryptSync(password, salt, 64);
  const right = Buffer.from(storedHash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number
  ) {}

  get expiresIn(): number {
    return this.ttlSeconds;
  }

  issue(userId: string, role: string): string {
    return jwt.sign({ role }, this.secret, { subject: userId, expiresIn: this.ttlSeconds, algorithm: 'HS256' });
  }

  verify(token: string): AuthContext {
    const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) {
      throw new Error('Invalid token payload');
    }
    return { userId: payload.sub, role: payload['role'] === 'moderator' ? 'moderator' : 'user' };
  }
}

/** Authenticates the bearer token and confirms the account still exists and is not blocked. */
export function requireAuth(tokens: TokenService, db: Db): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.header('authorization');
      if (!header?.startsWith('Bearer ')) {
        throw unauthorized('Missing bearer token');
      }
      let context: AuthContext;
      try {
        context = tokens.verify(header.slice('Bearer '.length).trim());
      } catch {
        throw unauthorized('Invalid or expired token');
      }
      const { rows } = await db.query<{ status: string; role: string }>('SELECT status, role FROM users WHERE id = $1', [
        context.userId
      ]);
      const user = rows[0];
      if (!user) {
        throw unauthorized('Account no longer exists');
      }
      if (user.status === 'blocked') {
        throw forbidden('Account is blocked');
      }
      req.auth = { userId: context.userId, role: user.role === 'moderator' ? 'moderator' : 'user' };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireModerator: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'moderator') {
    next(forbidden('Moderator role required'));
    return;
  }
  next();
};

export function currentUserId(req: Request): string {
  if (!req.auth) {
    throw unauthorized();
  }
  return req.auth.userId;
}
