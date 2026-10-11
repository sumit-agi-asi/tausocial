import { Router } from 'express';
import crypto from 'node:crypto';
import { RateLimitRequestHandler } from 'express-rate-limit';
import { conflict, forbidden, unauthorized, badRequest } from '../../errors';
import { ageOn } from '../../domain/age';
import { USER_COLUMNS, UserRow, toMyProfile } from '../../domain/mappers';
import { hashPassword, verifyPassword } from '../auth';
import { AppContext } from '../context';
import { LoginRequest, RegisterRequest } from '../schemas';

export function authRoutes(ctx: AppContext, limiter: RateLimitRequestHandler): Router {
  const router = Router();

  router.post('/register', limiter, async (req, res, next) => {
    try {
      const input = RegisterRequest.parse(req.body);
      if (ageOn(input.birthDate) < ctx.config.minSignupAge) {
        throw badRequest(`You must be at least ${ctx.config.minSignupAge} years old to join`);
      }
      const id = crypto.randomUUID();
      try {
        await ctx.db.query(
          'INSERT INTO users (id, email, username, password_hash, display_name, birth_date) VALUES ($1,$2,$3,$4,$5,$6)',
          [id, input.email, input.username, hashPassword(input.password), input.username, input.birthDate]
        );
      } catch (error) {
        const { code, message } = error as { code?: string; message: string };
        if (code === '23505' || /unique|duplicate/i.test(message)) {
          throw conflict('Email or username is already registered');
        }
        throw error;
      }
      const { rows } = await ctx.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
      const user = rows[0] as UserRow;
      res.status(201).json({
        token: ctx.tokens.issue(user.id, user.role),
        expiresIn: ctx.tokens.expiresIn,
        user: toMyProfile(user)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', limiter, async (req, res, next) => {
    try {
      const input = LoginRequest.parse(req.body);
      const { rows } = await ctx.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [input.email]);
      const user = rows[0];
      // Always run a password verification to keep timing similar for unknown emails.
      const valid = verifyPassword(input.password, user?.password_hash ?? 'invalid:invalid');
      if (!user || !valid) {
        throw unauthorized('Invalid email or password');
      }
      if (user.status === 'blocked') {
        throw forbidden('Account is blocked');
      }
      res.json({ token: ctx.tokens.issue(user.id, user.role), expiresIn: ctx.tokens.expiresIn, user: toMyProfile(user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
