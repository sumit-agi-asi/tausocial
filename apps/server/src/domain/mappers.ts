export interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  display_name: string;
  bio: string;
  birth_date: string;
  country: string | null;
  education: string | null;
  profession: string | null;
  interests: string[];
  dislikes: string[];
  privacy: { profileVisibility: 'public' | 'connections'; showRecentBubbles: boolean };
  preferences: { showConnectionPostsInFeed: boolean; theme: 'system' | 'light' | 'dark' };
  role: 'user' | 'moderator';
  status: 'active' | 'blocked';
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  phone: string | null;
  created_at: Date | string;
}

/** Column list producing the shape of UserRow; `birth_date` is cast to text to avoid timezone drift. */
export const USER_COLUMNS =
  'id, email, username, password_hash, display_name, bio, birth_date::text AS birth_date, country, education, profession, interests, dislikes, privacy, preferences, role, status, verification_status, phone, created_at';

export const iso = (value: Date | string | null): string | null =>
  value === null ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export function toPublicProfile(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    bio: row.bio,
    country: row.country,
    education: row.education,
    profession: row.profession,
    interests: row.interests,
    dislikes: row.dislikes,
    verificationStatus: row.verification_status,
    createdAt: iso(row.created_at) as string
  };
}

export function toMyProfile(row: UserRow) {
  return {
    ...toPublicProfile(row),
    email: row.email,
    birthDate: row.birth_date,
    phone: row.phone,
    role: row.role,
    privacy: row.privacy,
    preferences: row.preferences
  };
}

export interface PostRow {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  parent_id: string | null;
  body: string;
  media: { kind: 'image' | 'video' | 'audio'; url: string }[];
  tags: string[];
  flag: 'green' | 'yellow' | 'red';
  action: 'allow' | 'warn' | 'block';
  created_at: Date | string;
  edited_at: Date | string | null;
  upvotes: number;
  downvotes: number;
  reply_count: number;
  my_reaction: 'up' | 'down' | null;
}

export function toPost(row: PostRow) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name || row.author_username,
    parentId: row.parent_id,
    body: row.body,
    media: row.media,
    tags: row.tags,
    flag: row.flag,
    action: row.action,
    createdAt: iso(row.created_at) as string,
    editedAt: iso(row.edited_at),
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    replyCount: row.reply_count,
    myReaction: row.my_reaction
  };
}

/** SELECT used everywhere a post is returned. Expects the viewer id as `$1`. */
export const POST_SELECT = `
SELECT p.id, p.author_id, u.username AS author_username, u.display_name AS author_display_name, p.parent_id,
  p.body, p.media, p.tags, p.flag, p.action, p.created_at, p.edited_at,
  (SELECT count(*)::int FROM reactions r WHERE r.post_id = p.id AND r.kind = 'up') AS upvotes,
  (SELECT count(*)::int FROM reactions r WHERE r.post_id = p.id AND r.kind = 'down') AS downvotes,
  (SELECT count(*)::int FROM posts c WHERE c.parent_id = p.id AND c.action <> 'block') AS reply_count,
  (SELECT r.kind FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS my_reaction
FROM posts p JOIN users u ON u.id = p.author_id`;
