import { AnalysisResult, ContentAnalyzers, ContentTag } from './types';

/*
 * Heuristic, deterministic analyzers used until real AI services are connected.
 * TODO(owner): replace with model-backed implementations (see docs/QUESTIONS.md Q3, Q4).
 */
const ABUSE_TERMS = ['kill yourself', 'i will kill', 'kill you', 'hate you', 'idiot', 'stupid', 'scum'];
const VULGAR_TERMS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard'];
const FAKE_NEWS_PHRASES = [
  'share before it gets deleted',
  'they dont want you to know',
  "they don't want you to know",
  '100% proven',
  'doctors hate',
  'miracle cure',
  'media is hiding'
];

const lower = (text: string): string => text.toLowerCase();
const hits = (text: string, terms: string[]): string[] => terms.filter((term) => lower(text).includes(term));

const unknown = (analyzer: string, details: string): AnalysisResult => ({
  analyzer,
  verdict: 'unknown',
  tags: [],
  confidence: 0,
  details
});

function abuse(text: string): AnalysisResult {
  const abuseHits = hits(text, ABUSE_TERMS);
  const vulgarHits = hits(text, VULGAR_TERMS);
  const tags: ContentTag[] = [];
  if (abuseHits.length) tags.push('abuse');
  if (vulgarHits.length) tags.push('vulgar');
  if (tags.length === 0) {
    return { analyzer: 'abuseDetect', verdict: 'clean', tags, confidence: 0.6 };
  }
  return {
    analyzer: 'abuseDetect',
    verdict: 'violation',
    tags,
    confidence: Math.min(0.95, 0.7 + 0.1 * (abuseHits.length + vulgarHits.length)),
    details: `Matched ${abuseHits.length + vulgarHits.length} term(s)`
  };
}

function fakeNews(text: string): AnalysisResult {
  const matched = hits(text, FAKE_NEWS_PHRASES);
  if (matched.length === 0) {
    return { analyzer: 'fakeNewsDetect', verdict: 'clean', tags: [], confidence: 0.5 };
  }
  return {
    analyzer: 'fakeNewsDetect',
    verdict: 'suspect',
    tags: ['fake_news'],
    confidence: Math.min(0.9, 0.55 + 0.15 * matched.length),
    details: `Matched ${matched.length} misinformation phrase(s)`
  };
}

export const heuristicAnalyzers: ContentAnalyzers = {
  async analyseText(text) {
    const parts = [abuse(text), fakeNews(text)];
    const worst = parts.find((part) => part.verdict === 'violation') ?? parts.find((part) => part.verdict === 'suspect');
    if (!worst) {
      return { analyzer: 'analyseText', verdict: 'clean', tags: [], confidence: 0.6 };
    }
    return { ...worst, analyzer: 'analyseText', tags: [...new Set(parts.flatMap((part) => part.tags))] };
  },
  async abuseDetect(text) {
    return abuse(text);
  },
  async fakeNewsDetect(text) {
    return fakeNews(text);
  },
  async detectAI() {
    return unknown('detectAI', 'AI-generated content detection model is not connected');
  },
  async analyseVideo() {
    return unknown('analyseVideo', 'Video analysis model is not connected (morphed / movie clip detection)');
  },
  async analyseAudio() {
    return unknown('analyseAudio', 'Audio analysis model is not connected (existing audio detection)');
  }
};
