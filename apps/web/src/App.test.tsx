import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from './App';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    register: vi.fn(),
    login: vi.fn(),
    feed: vi.fn(),
    createPost: vi.fn(),
    likePost: vi.fn(),
    commentPost: vi.fn(),
    metrics: vi.fn(),
    insights: vi.fn()
  }
}));

const mockedApi = api as unknown as {
  register: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  feed: ReturnType<typeof vi.fn>;
  createPost: ReturnType<typeof vi.fn>;
  likePost: ReturnType<typeof vi.fn>;
  commentPost: ReturnType<typeof vi.fn>;
  metrics: ReturnType<typeof vi.fn>;
  insights: ReturnType<typeof vi.fn>;
};

const session = {
  token: 'token-1',
  user: {
    id: 'u1',
    username: 'demo',
    email: 'demo@tausocial.local',
    createdAt: new Date().toISOString()
  }
};

const feedPayload = {
  posts: [
    {
      id: 'p1',
      userId: 'u2',
      username: 'coach',
      content: 'Check in now',
      createdAt: new Date().toISOString(),
      likes: ['u1'],
      comments: [
        {
          id: 'c1',
          userId: 'u1',
          username: 'demo',
          content: 'Done!',
          createdAt: new Date().toISOString()
        }
      ],
      moderation: {
        label: 'safe' as const,
        score: 10,
        highlights: [],
        summary: 'Content looks safe for the community feed.'
      }
    }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.login.mockResolvedValue(session);
  mockedApi.register.mockResolvedValue(session);
  mockedApi.feed.mockResolvedValue(feedPayload);
  mockedApi.metrics.mockResolvedValue({
    metrics: {
      authoredPosts: 1,
      commentsMade: 2,
      likesReceived: 3,
      flaggedPosts: 0
    }
  });
  mockedApi.insights.mockResolvedValue({
    insights: {
      summary: 'Feed health: 1 safe, 0 watch, 0 flagged posts.',
      highRiskPosts: 0,
      watchPosts: 0,
      safePosts: 1,
      highlights: []
    }
  });
  mockedApi.createPost.mockResolvedValue({ post: feedPayload.posts[0] });
  mockedApi.likePost.mockResolvedValue({ post: feedPayload.posts[0] });
  mockedApi.commentPost.mockResolvedValue({ post: feedPayload.posts[0] });
});

describe('App', () => {
  it('shows login mode by default', () => {
    render(<App />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('switches to register mode', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Register'));
    expect(screen.getByText('Create account')).toBeInTheDocument();
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('logs in and renders dashboard', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByText('Accountability Dashboard')).toBeInTheDocument();
    });
  });

  it('loads moderation summary after login', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByText(/Feed health:/)).toBeInTheDocument();
    });
  });

  it('shows metric cards', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByText('Likes Received')).toBeInTheDocument();
      expect(screen.getByText('Flagged')).toBeInTheDocument();
    });
  });

  it('renders feed post', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByText('Check in now')).toBeInTheDocument();
      expect(screen.getByText('SAFE')).toBeInTheDocument();
    });
  });

  it('submits a new post', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByText('Publish')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Share your progress update'), {
      target: { value: 'New update for accountability' }
    });
    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockedApi.createPost).toHaveBeenCalled();
    });
  });

  it('likes a post', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByText('❤️ 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('❤️ 1'));

    await waitFor(() => {
      expect(mockedApi.likePost).toHaveBeenCalledWith('token-1', 'p1');
    });
  });

  it('adds a comment to a post', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Comment')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Comment'), {
      target: { value: 'Nice accountability move' }
    });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(mockedApi.commentPost).toHaveBeenCalled();
    });
  });

  it('registers a new account in register mode', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Register'));

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'sam' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Create account'));

    await waitFor(() => {
      expect(mockedApi.register).toHaveBeenCalledWith('sam', 'sam@example.com', 'password123');
    });
  });

  it('shows auth errors', async () => {
    mockedApi.login.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('fetches dashboard data after login', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Enter dashboard'));

    await waitFor(() => {
      expect(mockedApi.feed).toHaveBeenCalledWith('token-1');
      expect(mockedApi.metrics).toHaveBeenCalledWith('token-1');
      expect(mockedApi.insights).toHaveBeenCalledWith('token-1');
    });
  });
});
