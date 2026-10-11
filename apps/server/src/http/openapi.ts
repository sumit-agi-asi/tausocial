import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as s from './schemas';

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });

  const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { 'application/json': { schema } } });
  const body = <T extends z.ZodTypeAny>(schema: T) => ({ body: { required: true, ...json(schema) } });
  const err = (description: string) => ({ description, ...json(s.ErrorResponse) });
  const secured = [{ bearerAuth: [] }];
  const commonErrors = {
    400: err('Validation error'),
    401: err('Missing or invalid token'),
    429: err('Rate limited')
  };
  const idParam = z.object({ id: z.string() });
  const Items = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item) });

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const route = (
    method: Method,
    path: string,
    summary: string,
    tag: string,
    options: {
      auth?: boolean;
      request?: Record<string, unknown>;
      status?: number;
      response?: z.ZodTypeAny;
      extra?: Record<number, { description: string }>;
    } = {}
  ) => {
    const status = options.status ?? 200;
    registry.registerPath({
      method,
      path,
      summary,
      tags: [tag],
      ...(options.auth === false ? {} : { security: secured }),
      request: options.request as never,
      responses: {
        [status]: options.response ? { description: 'Success', ...json(options.response) } : { description: 'Success' },
        ...(options.auth === false ? { 400: commonErrors[400], 429: commonErrors[429] } : commonErrors),
        ...(options.extra ?? {})
      } as never
    });
  };
  const withId = { params: idParam };
  const notFound = { 404: err('Not found') };

  route('post', '/auth/register', 'Create an account', 'Auth', {
    auth: false,
    request: body(s.RegisterRequest),
    status: 201,
    response: s.AuthResponse,
    extra: { 409: err('Email or username taken') }
  });
  route('post', '/auth/login', 'Log in', 'Auth', {
    auth: false,
    request: body(s.LoginRequest),
    response: s.AuthResponse,
    extra: { 401: err('Invalid credentials') }
  });

  route('get', '/profiles/me', 'Get own profile', 'Profiles', { response: s.MyProfile });
  route('patch', '/profiles/me', 'Update own profile, settings, privacy and preferences', 'Profiles', {
    request: body(s.UpdateProfileRequest),
    response: s.MyProfile
  });
  route('delete', '/profiles/me', 'Permanently delete own account', 'Profiles', {
    request: body(s.DeleteAccountRequest),
    status: 204,
    extra: { 403: err('Password confirmation failed') }
  });
  route('post', '/profiles/me/verification', 'Submit identity verification (phone, government ID, address proof)', 'Profiles', {
    request: body(s.VerificationRequest),
    status: 202,
    response: s.VerificationResponse
  });
  route('get', '/profiles/{id}', 'Get a public profile', 'Profiles', {
    request: withId,
    response: s.PublicProfile,
    extra: notFound
  });
  route('put', '/profiles/{id}/block', 'Block a profile', 'Profiles', { request: withId, status: 204, extra: notFound });
  route('delete', '/profiles/{id}/block', 'Unblock a profile', 'Profiles', { request: withId, status: 204 });

  route('post', '/posts', 'Create a post or a reply (thread / sub-thread)', 'Posts', {
    request: body(s.CreatePostRequest),
    status: 201,
    response: s.PostResponse,
    extra: { 422: { description: 'Content blocked by moderation' }, 404: { description: 'Parent not found' } }
  });
  route('get', '/posts/{id}', 'Get a post', 'Posts', { request: withId, response: s.PostResponse, extra: notFound });
  route('patch', '/posts/{id}', 'Edit a post', 'Posts', {
    request: { ...withId, ...body(s.UpdatePostRequest) },
    response: s.PostResponse,
    extra: { 403: err('Not the author'), 422: { description: 'Content blocked by moderation' } }
  });
  route('delete', '/posts/{id}', 'Delete a post', 'Posts', { request: withId, status: 204, extra: notFound });
  route('get', '/posts/{id}/thread', 'Get a post with its replies', 'Posts', {
    request: withId,
    response: Items(s.PostResponse),
    extra: notFound
  });
  route('put', '/posts/{id}/reaction', 'Thumbs up / thumbs down', 'Posts', {
    request: { ...withId, ...body(s.ReactionRequest) },
    response: s.PostResponse
  });
  route('delete', '/posts/{id}/reaction', 'Remove reaction', 'Posts', { request: withId, response: s.PostResponse });
  route('post', '/posts/{id}/reports', 'Report a post', 'Posts', {
    request: { ...withId, ...body(s.ReportRequest) },
    status: 202
  });

  route('get', '/feed', 'Recommended feed', 'Feed', {
    request: { query: s.FeedQuery },
    response: s.FeedResponse
  });
  route('post', '/feed/refresh', 'Recompute the feed', 'Feed', { request: { query: s.FeedQuery }, response: s.FeedResponse });
  route('get', '/feed/bubbles', 'Connections with recent posts', 'Feed', { response: s.BubbleResponse });

  route('get', '/connections', 'List connections and requests', 'Connections', {
    response: z.object({ connections: z.array(s.ConnectionResponse) })
  });
  route('post', '/connections', 'Send a connection request', 'Connections', {
    request: body(s.ConnectionRequest),
    status: 201,
    extra: { 409: err('Already connected') }
  });
  route('post', '/connections/{userId}/accept', 'Accept a connection request', 'Connections', {
    request: { params: z.object({ userId: z.string() }) },
    extra: notFound
  });
  route('delete', '/connections/{userId}', 'Remove a connection', 'Connections', {
    request: { params: z.object({ userId: z.string() }) },
    status: 204,
    extra: notFound
  });
  route('get', '/connections/recommendations', 'Recommended connections by profile similarity', 'Connections', {
    response: z.object({ recommendations: z.array(s.RecommendationResponse), threshold: z.number() })
  });

  const text = ['analyse-text', 'abuse-detect', 'fake-news-detect'] as const;
  for (const name of text) {
    route('post', `/monitoring/${name}`, `Monitoring: ${name}`, 'Monitoring', {
      request: body(s.TextAnalysisRequest),
      response: s.AnalysisResult
    });
  }
  for (const name of ['analyse-video', 'analyse-audio'] as const) {
    route('post', `/monitoring/${name}`, `Monitoring: ${name}`, 'Monitoring', {
      request: body(s.MediaAnalysisRequest),
      response: s.AnalysisResult
    });
  }
  route('post', '/monitoring/detect-ai', 'Monitoring: detect AI generated content', 'Monitoring', {
    request: body(s.DetectAIRequest),
    response: s.AnalysisResult
  });
  route('post', '/monitoring/check-user-authenticity', 'Monitoring: account authenticity', 'Monitoring', {
    response: s.AnalysisResult
  });

  route('post', '/admin/profiles/{id}/block', 'Moderator: block a profile', 'Admin', {
    request: withId,
    status: 204,
    extra: { 403: err('Moderator role required'), ...notFound }
  });
  route('post', '/admin/profiles/{id}/unblock', 'Moderator: unblock a profile', 'Admin', {
    request: withId,
    status: 204,
    extra: { 403: err('Moderator role required'), ...notFound }
  });
  route('delete', '/admin/profiles/{id}', 'Moderator: delete a profile', 'Admin', {
    request: withId,
    status: 204,
    extra: { 403: err('Moderator role required'), ...notFound }
  });

  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'TauSocial API',
      version: '1.0.0',
      description: 'Social media with accountability, monitored by intelligence.'
    },
    servers: [{ url: '/api/v1' }]
  });
}
