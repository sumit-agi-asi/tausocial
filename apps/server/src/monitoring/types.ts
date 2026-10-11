export type ModerationFlag = 'green' | 'yellow' | 'red';
export type ModerationAction = 'allow' | 'warn' | 'block';

/** Tag taxonomy derived from the design sketches. */
export const CONTENT_TAGS = [
  'vulgar',
  'abuse',
  'unsafe',
  'fake_news',
  'ai_generated',
  'morphed',
  'altered',
  'edited',
  'movie_clip',
  'existing_audio',
  'recorded_video'
] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];

export type Verdict = 'clean' | 'suspect' | 'violation' | 'unknown';

export interface AnalysisResult {
  analyzer: string;
  verdict: Verdict;
  tags: ContentTag[];
  /** Confidence in [0,1]. 0 for `unknown`. */
  confidence: number;
  details?: string;
}

export interface TextAnalyzer {
  analyseText(text: string): Promise<AnalysisResult>;
  abuseDetect(text: string): Promise<AnalysisResult>;
  fakeNewsDetect(text: string): Promise<AnalysisResult>;
  detectAI(content: { text?: string; mediaUrl?: string }): Promise<AnalysisResult>;
}

export interface MediaAnalyzer {
  analyseVideo(mediaUrl: string): Promise<AnalysisResult>;
  analyseAudio(mediaUrl: string): Promise<AnalysisResult>;
}

export type ContentAnalyzers = TextAnalyzer & MediaAnalyzer;

export interface ModerationDecision {
  flag: ModerationFlag;
  action: ModerationAction;
  tags: ContentTag[];
  results: AnalysisResult[];
}
