export type Flag = 'green' | 'yellow' | 'red';
export type Reaction = 'up' | 'down';

export interface MediaItem {
  kind: 'image' | 'video' | 'audio';
  url: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  parentId: string | null;
  body: string;
  media: MediaItem[];
  tags: string[];
  flag: Flag;
  action: 'allow' | 'warn' | 'block';
  createdAt: string;
  editedAt: string | null;
  upvotes: number;
  downvotes: number;
  replyCount: number;
  myReaction: Reaction | null;
}

export interface FeedItem extends Post {
  rank: { score: number; reason: string };
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  country: string | null;
  education: string | null;
  profession: string | null;
  interests: string[];
  dislikes: string[];
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

export interface MyProfile extends PublicProfile {
  email: string;
  birthDate: string;
  phone: string | null;
  role: 'user' | 'moderator';
  privacy: { profileVisibility: 'public' | 'connections'; showRecentBubbles: boolean };
  preferences: { showConnectionPostsInFeed: boolean; theme: 'system' | 'light' | 'dark' };
}

export interface Session {
  token: string;
  user: MyProfile;
}

export interface Bubble {
  userId: string;
  username: string;
  latestPostId: string;
  latestPostAt: string;
}

export interface Connection {
  userId: string;
  username: string;
  displayName: string;
  status: 'pending_outgoing' | 'pending_incoming' | 'accepted';
  score: number | null;
  flag: 'none' | 'yellow';
}

export interface Recommendation {
  userId: string;
  username: string;
  displayName: string;
  score: number;
}
