export type ModerationLabel = 'safe' | 'watch' | 'flagged';

export interface ModerationResult {
  label: ModerationLabel;
  score: number;
  highlights: string[];
  summary: string;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  likes: string[];
  comments: Comment[];
  moderation: ModerationResult;
}

export interface AccountMetrics {
  authoredPosts: number;
  commentsMade: number;
  likesReceived: number;
  flaggedPosts: number;
}

export interface FeedInsights {
  summary: string;
  highRiskPosts: number;
  watchPosts: number;
  safePosts: number;
  highlights: string[];
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}
