import { Config } from '../config';
import { Db } from '../db';
import { AudiencePolicy } from '../domain/audience';
import { ProfileSimilarityScorer } from '../domain/similarity';
import { Logger } from '../logger';
import { ModerationService } from '../monitoring/service';
import { TokenService } from './auth';

export interface AppContext {
  config: Config;
  db: Db;
  logger: Logger;
  tokens: TokenService;
  moderation: ModerationService;
  similarity: ProfileSimilarityScorer;
  audience: AudiencePolicy;
}
