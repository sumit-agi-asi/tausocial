import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(6).max(128)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128)
});

export const postSchema = z.object({
  content: z.string().min(3).max(400)
});

export const commentSchema = z.object({
  content: z.string().min(1).max(280)
});
