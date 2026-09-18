import { describe, expect, it } from 'vitest';
import { scoreContent } from './moderation';

describe('scoreContent', () => {
  it('labels neutral text as safe', () => {
    expect(scoreContent('great progress update').label).toBe('safe');
  });

  it('uses safe summary for safe content', () => {
    expect(scoreContent('great progress update').summary).toContain('safe');
  });

  it('detects watch content', () => {
    expect(scoreContent('I am angry today').label).toBe('watch');
  });

  it('detects flagged content', () => {
    expect(scoreContent('I hate this and will kill momentum').label).toBe('flagged');
  });

  it('includes watch highlights', () => {
    expect(scoreContent('angry message').highlights).toContain('angry');
  });

  it('includes flagged highlights', () => {
    expect(scoreContent('this is a scam').highlights).toContain('scam');
  });

  it('is case insensitive', () => {
    expect(scoreContent('HATE speech').label).toBe('flagged');
  });

  it('keeps score within range', () => {
    const score = scoreContent('hate scam kill fraud angry fight').score;
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('watch summary communicates monitoring', () => {
    expect(scoreContent('angry and upset').summary).toContain('monitoring');
  });

  it('flagged summary communicates review', () => {
    expect(scoreContent('kill and fraud').summary).toContain('review');
  });
});
