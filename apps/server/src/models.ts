export type ModerationLabel = 'safe' | 'watch' | 'flagged';

export interface ModerationResult {
  label: ModerationLabel;
  score: number;
  highlights: string[];
  summary: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
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

export interface StorageData {
  users: User[];
  posts: Post[];
}
