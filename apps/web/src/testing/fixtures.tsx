import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth';
import { FeedItem, MyProfile, Post } from '../types';

export const me: MyProfile = {
  id: 'u1',
  username: 'alice',
  displayName: 'Alice',
  bio: 'Hello',
  country: 'IT',
  education: 'MSc',
  profession: 'Engineer',
  interests: ['hiking'],
  dislikes: [],
  verificationStatus: 'unverified',
  createdAt: '2026-01-01T00:00:00.000Z',
  email: 'alice@example.com',
  birthDate: '1990-01-01',
  phone: null,
  role: 'user',
  privacy: { profileVisibility: 'public', showRecentBubbles: true },
  preferences: { showConnectionPostsInFeed: false, theme: 'system' }
};

export const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  authorId: 'u2',
  authorUsername: 'bob',
  authorDisplayName: 'Bob',
  parentId: null,
  body: 'Hello from Bob',
  media: [],
  tags: [],
  flag: 'green',
  action: 'allow',
  createdAt: '2026-02-01T10:00:00.000Z',
  editedAt: null,
  upvotes: 0,
  downvotes: 0,
  replyCount: 0,
  myReaction: null,
  ...overrides
});

export const makeFeedItem = (overrides: Partial<Post> = {}): FeedItem => ({
  ...makePost(overrides),
  rank: { score: 1, reason: 'chronological' }
});

export function signedIn(user: MyProfile = me): void {
  sessionStorage.setItem('tausocial.session', JSON.stringify({ token: 't', user }));
}

export function renderApp(route = '/feed') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

export function mockApi() {
  return {
    register: vi.fn(),
    login: vi.fn(),
    me: vi.fn(async () => me),
    updateMe: vi.fn(),
    deleteMe: vi.fn(),
    submitVerification: vi.fn(),
    profile: vi.fn(),
    blockProfile: vi.fn(),
    feed: vi.fn(async () => ({ items: [], recommender: 'chronological' })),
    refreshFeed: vi.fn(async () => ({ items: [], recommender: 'chronological' })),
    bubbles: vi.fn(async () => ({ bubbles: [] })),
    createPost: vi.fn(),
    editPost: vi.fn(),
    deletePost: vi.fn(),
    thread: vi.fn(),
    react: vi.fn(),
    unreact: vi.fn(),
    report: vi.fn(),
    connections: vi.fn(async () => ({ connections: [] })),
    recommendations: vi.fn(async () => ({ recommendations: [], threshold: 0.8 })),
    connect: vi.fn(),
    acceptConnection: vi.fn(),
    removeConnection: vi.fn()
  };
}
