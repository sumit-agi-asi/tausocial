import { AccountMetrics, FeedInsights, Post, SessionUser } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface SessionResponse {
  token: string;
  user: SessionUser;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(init.headers ?? {})
    }
  });

  const payload = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    const message = (payload as { message?: string }).message ?? 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  register(username: string, email: string, password: string): Promise<SessionResponse> {
    return request<SessionResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  },
  login(email: string, password: string): Promise<SessionResponse> {
    return request<SessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  feed(token: string): Promise<{ posts: Post[] }> {
    return request<{ posts: Post[] }>('/feed', {}, token);
  },
  createPost(token: string, content: string): Promise<{ post: Post }> {
    return request<{ post: Post }>('/feed/posts', {
      method: 'POST',
      body: JSON.stringify({ content })
    }, token);
  },
  likePost(token: string, postId: string): Promise<{ post: Post }> {
    return request<{ post: Post }>(`/feed/posts/${postId}/like`, { method: 'POST' }, token);
  },
  commentPost(token: string, postId: string, content: string): Promise<{ post: Post }> {
    return request<{ post: Post }>(`/feed/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    }, token);
  },
  metrics(token: string): Promise<{ metrics: AccountMetrics }> {
    return request<{ metrics: AccountMetrics }>('/metrics/accountability', {}, token);
  },
  insights(token: string): Promise<{ insights: FeedInsights }> {
    return request<{ insights: FeedInsights }>('/insights/feed', {}, token);
  }
};
