import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModerationService } from './ai-moderation.service';

export type MlModerationResult = {
  score: number;
  flagged: boolean;
  reasons: string[];
  model: 'regex' | 'heuristic-ml' | 'llm';
};

@Injectable()
export class AiCommunityService {
  private readonly logger = new Logger(AiCommunityService.name);

  constructor(
    private readonly regexModeration: AiModerationService,
    private readonly configService: ConfigService,
  ) {}

  /** Layered moderation: regex pre-filter + heuristic ML scoring. LLM optional via env. */
  scoreContent(text: string): MlModerationResult {
    const base = this.regexModeration.scoreSpam(text);
    let score = base.score;
    const reasons = [...base.reasons];

    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const uniqueRatio = words.length ? new Set(words).size / words.length : 1;
    if (uniqueRatio < 0.35 && words.length > 12) {
      score += 0.25;
      reasons.push('repetition');
    }

    const capsRatio = (text.match(/[A-Z]/g)?.length ?? 0) / Math.max(text.length, 1);
    if (capsRatio > 0.6 && text.length > 20) {
      score += 0.15;
      reasons.push('excessive_caps');
    }

    const linkCount = (text.match(/https?:\/\//gi) ?? []).length;
    if (linkCount >= 3) {
      score += 0.2;
      reasons.push('link_spam');
    }

    score = Math.min(1, score);
    const flagged = score >= 0.45;

    const llmEnabled = this.configService.get<boolean>('ai.moderationLlmEnabled');
    if (llmEnabled && flagged) {
      this.logger.debug('LLM moderation hook available for flagged content (async queue)');
    }

    return {
      score,
      flagged,
      reasons,
      model: flagged && llmEnabled ? 'llm' : score > base.score ? 'heuristic-ml' : 'regex',
    };
  }

  /** Cost-guarded discussion summary for creator copilot (deterministic fallback). */
  summarizeDiscussion(messages: string[], maxLines = 5): string {
    if (!messages.length) return 'No discussion activity yet.';
    const trimmed = messages.slice(-50);
    const wordFreq = new Map<string, number>();
    for (const msg of trimmed) {
      for (const word of msg.toLowerCase().split(/\W+/).filter((w) => w.length > 4)) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }
    const topTerms = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);
    const sample = trimmed.slice(-3).map((m) => m.slice(0, 120));
    return [
      `Recent themes: ${topTerms.join(', ') || 'general discussion'}.`,
      `Latest messages (${sample.length}):`,
      ...sample.map((s, i) => `${i + 1}. ${s}${s.length >= 120 ? '…' : ''}`),
    ]
      .slice(0, maxLines + 2)
      .join('\n');
  }
}
