import { Post } from './models';

export function buildAccountabilityMetrics(posts: Post[], userId: string): {
  authoredPosts: number;
  commentsMade: number;
  likesReceived: number;
  flaggedPosts: number;
} {
  const authored = posts.filter((post) => post.userId === userId);
  const commentsMade = posts.flatMap((post) => post.comments).filter((comment) => comment.userId === userId).length;

  return {
    authoredPosts: authored.length,
    commentsMade,
    likesReceived: authored.reduce((sum, post) => sum + post.likes.length, 0),
    flaggedPosts: authored.filter((post) => post.moderation.label === 'flagged').length
  };
}

export function generateFeedInsights(posts: Post[]): {
  summary: string;
  highRiskPosts: number;
  watchPosts: number;
  safePosts: number;
  highlights: string[];
} {
  const highRiskPosts = posts.filter((post) => post.moderation.label === 'flagged').length;
  const watchPosts = posts.filter((post) => post.moderation.label === 'watch').length;
  const safePosts = posts.filter((post) => post.moderation.label === 'safe').length;
  const highlights = posts.flatMap((post) => post.moderation.highlights).slice(0, 8);

  return {
    summary: `Feed health: ${safePosts} safe, ${watchPosts} watch, ${highRiskPosts} flagged posts.`,
    highRiskPosts,
    watchPosts,
    safePosts,
    highlights
  };
}
