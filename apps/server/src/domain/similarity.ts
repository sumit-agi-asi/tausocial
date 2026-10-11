export interface SimilarityProfile {
  age: number;
  profession?: string | null;
  education?: string | null;
  country?: string | null;
  bio?: string;
  interests: string[];
  dislikes: string[];
}

/**
 * Contract: returns a score in [0, 1] where 1 means identical profiles. Must be symmetric and deterministic.
 * Attributes come from the design (age, profession, education, location, description, likes/dislikes).
 *
 * TODO(owner): the real "profile similarity" definition is not specified. See docs/QUESTIONS.md Q1.
 */
export interface ProfileSimilarityScorer {
  score(a: SimilarityProfile, b: SimilarityProfile): number;
}

const norm = (value?: string | null): string => (value ?? '').trim().toLowerCase();

function jaccard(a: string[], b: string[]): number {
  const left = new Set(a.map(norm).filter(Boolean));
  const right = new Set(b.map(norm).filter(Boolean));
  if (left.size === 0 && right.size === 0) return 0;
  let shared = 0;
  for (const item of left) {
    if (right.has(item)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

const equal = (a?: string | null, b?: string | null): number => (norm(a) !== '' && norm(a) === norm(b) ? 1 : 0);

/** Placeholder weighted-average scorer. Weights are NOT product decisions; replace once the owner answers Q1. */
export const defaultSimilarityScorer: ProfileSimilarityScorer = {
  score(a, b) {
    const ageScore = Math.max(0, 1 - Math.abs(a.age - b.age) / 20);
    const likes = jaccard(a.interests, b.interests);
    const dislikes = jaccard(a.dislikes, b.dislikes);
    const weighted =
      0.15 * ageScore +
      0.15 * equal(a.profession, b.profession) +
      0.15 * equal(a.education, b.education) +
      0.2 * equal(a.country, b.country) +
      0.25 * likes +
      0.1 * dislikes;
    return Math.round(weighted * 100) / 100;
  }
};
