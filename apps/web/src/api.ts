import { Bubble, Connection, FeedItem, MyProfile, Post, PublicProfile, Reaction, Recommendation, Session } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly moderation?: { flag: string; action: string; tags: string[] }
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenProvider = () => string | null;
let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: (() => void) | undefined;

export function configureApi(options: { getToken: TokenProvider; onUnauthorized: () => void }): void {
  tokenProvider = options.getToken;
  unauthorizedHandler = options.onUnauthorized;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenProvider();
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach TauSocial. Check your connection and try again.');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string }; moderation?: ApiError['moderation'] }
    | null;
  if (!response.ok) {
    if (response.status === 401 && token) {
      unauthorizedHandler?.();
    }
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'error',
      payload?.error?.message ?? 'Something went wrong',
      payload?.moderation
    );
  }
  return payload as T;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  country?: string | null;
  education?: string | null;
  profession?: string | null;
  interests?: string[];
  dislikes?: string[];
  privacy?: MyProfile['privacy'];
  preferences?: MyProfile['preferences'];
}

export const api = {
  register: (input: { email: string; username: string; password: string; birthDate: string }) =>
    request<Session & { expiresIn: number }>('POST', '/auth/register', input),
  login: (input: { email: string; password: string }) => request<Session & { expiresIn: number }>('POST', '/auth/login', input),
  me: () => request<MyProfile>('GET', '/profiles/me'),
  updateMe: (input: UpdateProfileInput) => request<MyProfile>('PATCH', '/profiles/me', input),
  deleteMe: (password: string) => request<void>('DELETE', '/profiles/me', { password }),
  submitVerification: (input: { phone: string; govIdRef: string; addressProofRef: string }) =>
    request<{ id: string; status: string }>('POST', '/profiles/me/verification', input),
  profile: (id: string) => request<PublicProfile>('GET', `/profiles/${id}`),
  blockProfile: (id: string) => request<void>('PUT', `/profiles/${id}/block`),
  feed: (limit = 30) => request<{ items: FeedItem[]; recommender: string }>('GET', `/feed?limit=${limit}`),
  refreshFeed: (limit = 30) => request<{ items: FeedItem[]; recommender: string }>('POST', `/feed/refresh?limit=${limit}`),
  bubbles: () => request<{ bubbles: Bubble[] }>('GET', '/feed/bubbles'),
  createPost: (input: { body: string; parentId?: string; media?: { kind: string; url: string }[] }) =>
    request<Post>('POST', '/posts', input),
  editPost: (id: string, body: string) => request<Post>('PATCH', `/posts/${id}`, { body }),
  deletePost: (id: string) => request<void>('DELETE', `/posts/${id}`),
  thread: (id: string) => request<{ items: Post[] }>('GET', `/posts/${id}/thread`),
  react: (id: string, kind: Reaction) => request<Post>('PUT', `/posts/${id}/reaction`, { kind }),
  unreact: (id: string) => request<Post>('DELETE', `/posts/${id}/reaction`),
  report: (id: string, reason: string) => request<unknown>('POST', `/posts/${id}/reports`, { reason }),
  connections: () => request<{ connections: Connection[] }>('GET', '/connections'),
  recommendations: () =>
    request<{ recommendations: Recommendation[]; threshold: number }>('GET', '/connections/recommendations'),
  connect: (userId: string) => request<unknown>('POST', '/connections', { userId }),
  acceptConnection: (userId: string) => request<unknown>('POST', `/connections/${userId}/accept`),
  removeConnection: (userId: string) => request<void>('DELETE', `/connections/${userId}`)
};

export type Api = typeof api;
