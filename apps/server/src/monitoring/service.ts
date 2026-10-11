import { heuristicAnalyzers } from './analyzers';
import { decide } from './policy';
import { ContentAnalyzers, ModerationDecision } from './types';

export interface ModerationInput {
  text: string;
  mediaUrls?: { kind: 'image' | 'video' | 'audio'; url: string }[];
}

export class ModerationService {
  constructor(private readonly analyzers: ContentAnalyzers = heuristicAnalyzers) {}

  get providers(): ContentAnalyzers {
    return this.analyzers;
  }

  /** Runs every analyzer relevant to the content and applies the moderation policy. */
  async moderate(input: ModerationInput): Promise<ModerationDecision> {
    const media = input.mediaUrls ?? [];
    const results = await Promise.all([
      this.analyzers.analyseText(input.text),
      this.analyzers.abuseDetect(input.text),
      this.analyzers.fakeNewsDetect(input.text),
      this.analyzers.detectAI({ text: input.text }),
      ...media
        .filter((item) => item.kind === 'video')
        .map((item) => this.analyzers.analyseVideo(item.url)),
      ...media
        .filter((item) => item.kind === 'audio')
        .map((item) => this.analyzers.analyseAudio(item.url))
    ]);
    return decide(results);
  }
}
