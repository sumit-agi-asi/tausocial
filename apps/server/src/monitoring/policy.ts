import { AnalysisResult, ContentTag, ModerationDecision } from './types';

/**
 * Maps analyzer output to the flag colours in the design: red = unsafe, yellow = fake/altered, green = safe.
 * TODO(owner): the exact rules (thresholds, which tags block vs. warn, appeal flow) are not defined.
 * See docs/QUESTIONS.md Q2. The mapping below is a conservative placeholder.
 */
export function decide(results: AnalysisResult[]): ModerationDecision {
  const tags = [...new Set(results.flatMap((result) => result.tags))] as ContentTag[];
  const violation = results.some((result) => result.verdict === 'violation');
  const suspect = results.some((result) => result.verdict === 'suspect');

  if (violation) {
    return { flag: 'red', action: 'block', tags, results };
  }
  if (suspect) {
    return { flag: 'yellow', action: 'warn', tags, results };
  }
  return { flag: 'green', action: 'allow', tags, results };
}
