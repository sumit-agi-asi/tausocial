import { RequestHandler, Router } from 'express';
import { USER_COLUMNS, UserRow } from '../../domain/mappers';
import { AnalysisResult } from '../../monitoring/types';
import { currentUserId } from '../auth';
import { AppContext } from '../context';
import { DetectAIRequest, MediaAnalysisRequest, TextAnalysisRequest } from '../schemas';

/** Endpoints mirroring the "Monitoring & Tagging" API list in the design. */
export function monitoringRoutes(ctx: AppContext, auth: RequestHandler): Router {
  const router = Router();
  router.use(auth);
  const providers = ctx.moderation.providers;

  const text = (path: string, run: (value: string) => Promise<AnalysisResult>) =>
    router.post(path, async (req, res, next) => {
      try {
        res.json(await run(TextAnalysisRequest.parse(req.body).text));
      } catch (error) {
        next(error);
      }
    });
  const media = (path: string, run: (url: string) => Promise<AnalysisResult>) =>
    router.post(path, async (req, res, next) => {
      try {
        res.json(await run(MediaAnalysisRequest.parse(req.body).mediaUrl));
      } catch (error) {
        next(error);
      }
    });

  text('/analyse-text', (value) => providers.analyseText(value));
  text('/abuse-detect', (value) => providers.abuseDetect(value));
  text('/fake-news-detect', (value) => providers.fakeNewsDetect(value));
  media('/analyse-video', (url) => providers.analyseVideo(url));
  media('/analyse-audio', (url) => providers.analyseAudio(url));

  router.post('/detect-ai', async (req, res, next) => {
    try {
      res.json(await providers.detectAI(DetectAIRequest.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  /**
   * Authenticity signal for the caller's account: derived from verification state only.
   * TODO(owner): real ID/address document checking is undefined (docs/QUESTIONS.md Q6).
   */
  router.post('/check-user-authenticity', async (req, res, next) => {
    try {
      const { rows } = await ctx.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [currentUserId(req)]);
      const status = rows[0]?.verification_status ?? 'unverified';
      const result: AnalysisResult = {
        analyzer: 'checkUserAuthenticity',
        verdict: status === 'verified' ? 'clean' : status === 'rejected' ? 'violation' : 'unknown',
        tags: [],
        confidence: status === 'verified' ? 1 : 0,
        details: `Verification status: ${status}`
      };
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
