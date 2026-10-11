import { Db } from './index';

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  birth_date date NOT NULL,
  country text,
  education text,
  profession text,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  dislikes jsonb NOT NULL DEFAULT '[]'::jsonb,
  privacy jsonb NOT NULL DEFAULT '{"profileVisibility":"public","showRecentBubbles":true}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{"showConnectionPostsInFeed":false,"theme":"system"}'::jsonb,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE verifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  gov_id_ref text NOT NULL,
  address_proof_ref text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verifications_user_idx ON verifications (user_id, created_at DESC);

CREATE TABLE connections (
  requester_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  score real,
  flag text NOT NULL DEFAULT 'none' CHECK (flag IN ('none','yellow')),
  flagged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX connections_addressee_idx ON connections (addressee_id);

CREATE TABLE blocks (
  blocker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE posts (
  id text PRIMARY KEY,
  author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id text REFERENCES posts(id) ON DELETE CASCADE,
  body text NOT NULL,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  flag text NOT NULL DEFAULT 'green' CHECK (flag IN ('green','yellow','red')),
  action text NOT NULL DEFAULT 'allow' CHECK (action IN ('allow','warn','block')),
  moderation jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX posts_created_idx ON posts (created_at DESC);
CREATE INDEX posts_author_idx ON posts (author_id, created_at DESC);
CREATE INDEX posts_parent_idx ON posts (parent_id);

CREATE TABLE reactions (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('up','down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE reports (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
`
  }
];

/** Applies pending migrations in order inside a transaction each. Safe to run repeatedly. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
  );
  const applied = new Set((await db.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((row) => row.id));
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    await db.tx(async (tx) => {
      for (const statement of migration.sql.split(/;\s*\n/).map((part) => part.trim()).filter(Boolean)) {
        await tx.query(statement);
      }
      await tx.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
    });
    newlyApplied.push(migration.id);
  }
  return newlyApplied;
}
