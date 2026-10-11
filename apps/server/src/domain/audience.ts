import { AgeBand } from './age';
import { ModerationFlag } from '../monitoring/types';

/**
 * Decides whether a viewer in a given age band may see content with a given flag ("block from a group"
 * in the design, brackets <14, <18, <40, >40).
 * TODO(owner): the restriction matrix is undefined. See docs/QUESTIONS.md Q5. Default allows everything
 * that was not already blocked at publish time.
 */
export interface AudiencePolicy {
  canView(viewerBand: AgeBand, flag: ModerationFlag, tags: readonly string[]): boolean;
}

export const permissiveAudiencePolicy: AudiencePolicy = {
  canView: () => true
};
