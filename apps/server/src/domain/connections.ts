import { Db } from '../db';
import { ageOn } from './age';
import { UserRow, USER_COLUMNS } from './mappers';
import { ProfileSimilarityScorer, SimilarityProfile } from './similarity';

export function toSimilarityProfile(row: UserRow): SimilarityProfile {
  return {
    age: ageOn(row.birth_date),
    profession: row.profession,
    education: row.education,
    country: row.country,
    bio: row.bio,
    interests: row.interests,
    dislikes: row.dislikes
  };
}

/**
 * Re-scores accepted connections of a user after a profile change ("dynamic connection" in the design).
 * Connections that fall below the threshold are marked with a yellow flag; they are NOT removed.
 * TODO(owner): when/how a yellow-flagged connection is removed is undefined. See docs/QUESTIONS.md Q1.
 */
export async function rescoreConnections(
  db: Db,
  scorer: ProfileSimilarityScorer,
  userId: string,
  threshold: number
): Promise<{ rescored: number; flagged: number }> {
  const { rows: meRows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  const me = meRows[0];
  if (!me) {
    return { rescored: 0, flagged: 0 };
  }
  const { rows: others } = await db.query<UserRow & { requester_id: string; addressee_id: string }>(
    `SELECT u.id, u.email, u.username, u.password_hash, u.display_name, u.bio, u.birth_date::text AS birth_date,
            u.country, u.education, u.profession, u.interests, u.dislikes, u.privacy, u.preferences, u.role,
            u.status, u.verification_status, u.phone, u.created_at, c.requester_id, c.addressee_id
       FROM connections c
       JOIN users u ON u.id = CASE WHEN c.requester_id = $1 THEN c.addressee_id ELSE c.requester_id END
      WHERE c.status = 'accepted' AND (c.requester_id = $1 OR c.addressee_id = $1)`,
    [userId]
  );

  let flagged = 0;
  const mine = toSimilarityProfile(me);
  for (const other of others) {
    const score = scorer.score(mine, toSimilarityProfile(other));
    const low = score < threshold;
    if (low) flagged += 1;
    await db.query(
      `UPDATE connections
          SET score = $3,
              flag = CASE WHEN $4::boolean THEN 'yellow' ELSE 'none' END,
              flagged_at = CASE WHEN $4::boolean THEN COALESCE(flagged_at, now()) ELSE NULL END
        WHERE requester_id = $1 AND addressee_id = $2`,
      [other.requester_id, other.addressee_id, score, low]
    );
  }
  return { rescored: others.length, flagged };
}
