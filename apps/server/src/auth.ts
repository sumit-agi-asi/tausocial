import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from './models';

const secret = process.env.JWT_SECRET ?? 'tausocial-dev-secret';

export interface AuthContext {
  userId: string;
  email: string;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function issueToken(user: User): string {
  return jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthContext {
  return jwt.verify(token, secret) as AuthContext;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing bearer token' });
    return;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}
