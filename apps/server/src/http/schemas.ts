import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CONTENT_TAGS } from '../monitoring/types';

extendZodWithOpenApi(z);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const validDate = isoDate.refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) && parsed <= new Date();
}, 'Must be a valid date in the past');

const tagList = z.array(z.string().trim().min(1).max(40)).max(30);

export const RegisterRequest = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,30}$/, '3-30 characters: letters, digits, underscore'),
    password: z.string().min(10).max(128),
    birthDate: validDate
  })
  .openapi('RegisterRequest');

export const LoginRequest = z
  .object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) })
  .openapi('LoginRequest');

export const UpdateProfileRequest = z
  .object({
    displayName: z.string().trim().max(60),
    bio: z.string().trim().max(500),
    country: z.string().trim().max(60).nullable(),
    education: z.string().trim().max(80).nullable(),
    profession: z.string().trim().max(80).nullable(),
    interests: tagList,
    dislikes: tagList,
    privacy: z.object({
      profileVisibility: z.enum(['public', 'connections']),
      showRecentBubbles: z.boolean()
    }),
    preferences: z.object({
      showConnectionPostsInFeed: z.boolean(),
      theme: z.enum(['system', 'light', 'dark'])
    })
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
  .openapi('UpdateProfileRequest');

export const VerificationRequest = z
  .object({
    phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Use E.164 format, e.g. +14155550123'),
    govIdRef: z.string().trim().min(1).max(512),
    addressProofRef: z.string().trim().min(1).max(512)
  })
  .openapi('VerificationRequest');

export const DeleteAccountRequest = z.object({ password: z.string().min(1).max(128) }).openapi('DeleteAccountRequest');

const MediaItem = z
  .object({
    kind: z.enum(['image', 'video', 'audio']),
    url: z
      .string()
      .url()
      .max(2048)
      .refine((value) => value.startsWith('https://'), 'Media URL must use https')
  })
  .openapi('MediaItem');

export const CreatePostRequest = z
  .object({
    body: z.string().trim().min(1).max(2000),
    parentId: z.string().min(1).max(64).optional(),
    media: z.array(MediaItem).max(10).default([])
  })
  .openapi('CreatePostRequest');

export const UpdatePostRequest = z.object({ body: z.string().trim().min(1).max(2000) }).openapi('UpdatePostRequest');

export const ReactionRequest = z.object({ kind: z.enum(['up', 'down']) }).openapi('ReactionRequest');

export const ReportRequest = z
  .object({ reason: z.enum(['abuse', 'fake_news', 'ai_generated', 'morphed', 'vulgar', 'other']) })
  .openapi('ReportRequest');

export const ConnectionRequest = z.object({ userId: z.string().min(1).max(64) }).openapi('ConnectionRequest');

export const FeedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

export const TextAnalysisRequest = z.object({ text: z.string().min(1).max(10_000) }).openapi('TextAnalysisRequest');
export const MediaAnalysisRequest = z
  .object({ mediaUrl: z.string().url().max(2048) })
  .openapi('MediaAnalysisRequest');
export const DetectAIRequest = z
  .object({ text: z.string().min(1).max(10_000).optional(), mediaUrl: z.string().url().max(2048).optional() })
  .refine((value) => value.text || value.mediaUrl, 'Provide text or mediaUrl')
  .openapi('DetectAIRequest');

/* ---------- Responses ---------- */

export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.union([z.array(z.record(z.string())), z.object({}).passthrough()]).optional(),
      requestId: z.string().optional()
    })
  })
  .openapi('ErrorResponse');

export const PublicProfile = z
  .object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    bio: z.string(),
    country: z.string().nullable(),
    education: z.string().nullable(),
    profession: z.string().nullable(),
    interests: z.array(z.string()),
    dislikes: z.array(z.string()),
    verificationStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']),
    createdAt: z.string()
  })
  .openapi('PublicProfile');

export const MyProfile = PublicProfile.extend({
  email: z.string(),
  birthDate: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['user', 'moderator']),
  privacy: z.object({ profileVisibility: z.enum(['public', 'connections']), showRecentBubbles: z.boolean() }),
  preferences: z.object({
    showConnectionPostsInFeed: z.boolean(),
    theme: z.enum(['system', 'light', 'dark'])
  })
}).openapi('MyProfile');

export const AuthResponse = z
  .object({ token: z.string(), expiresIn: z.number().int(), user: MyProfile })
  .openapi('AuthResponse');

export const AnalysisResult = z
  .object({
    analyzer: z.string(),
    verdict: z.enum(['clean', 'suspect', 'violation', 'unknown']),
    tags: z.array(z.enum(CONTENT_TAGS)),
    confidence: z.number().min(0).max(1),
    details: z.string().optional()
  })
  .openapi('AnalysisResult');

export const PostResponse = z
  .object({
    id: z.string(),
    authorId: z.string(),
    authorUsername: z.string(),
    authorDisplayName: z.string(),
    parentId: z.string().nullable(),
    body: z.string(),
    media: z.array(MediaItem),
    tags: z.array(z.string()),
    flag: z.enum(['green', 'yellow', 'red']),
    action: z.enum(['allow', 'warn', 'block']),
    createdAt: z.string(),
    editedAt: z.string().nullable(),
    upvotes: z.number().int(),
    downvotes: z.number().int(),
    replyCount: z.number().int(),
    myReaction: z.enum(['up', 'down']).nullable().openapi({ type: 'string', enum: ['up', 'down', null as never], ...({ nullable: true } as object) })
  })
  .openapi('Post');

export const FeedResponse = z
  .object({
    items: z.array(PostResponse.extend({ rank: z.object({ score: z.number(), reason: z.string() }) })),
    recommender: z.string()
  })
  .openapi('FeedResponse');

export const BubbleResponse = z
  .object({
    bubbles: z.array(z.object({ userId: z.string(), username: z.string(), latestPostId: z.string(), latestPostAt: z.string() }))
  })
  .openapi('BubbleResponse');

export const ConnectionResponse = z
  .object({
    userId: z.string(),
    username: z.string(),
    displayName: z.string(),
    status: z.enum(['pending_outgoing', 'pending_incoming', 'accepted']),
    score: z.number().nullable(),
    flag: z.enum(['none', 'yellow'])
  })
  .openapi('Connection');

export const RecommendationResponse = z
  .object({ userId: z.string(), username: z.string(), displayName: z.string(), score: z.number() })
  .openapi('ConnectionRecommendation');

export const VerificationResponse = z
  .object({ id: z.string(), status: z.enum(['pending', 'verified', 'rejected']), createdAt: z.string() })
  .openapi('Verification');

export const BlockedPostResponse = ErrorResponse.extend({
  moderation: z.object({
    flag: z.enum(['green', 'yellow', 'red']),
    action: z.enum(['allow', 'warn', 'block']),
    tags: z.array(z.string())
  })
}).openapi('BlockedPostResponse');
