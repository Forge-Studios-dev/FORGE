import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SPAM_PATTERNS = [
  /\b(buy now|click here|free money|crypto pump)\b/i,
  /(https?:\/\/){2,}/i,
  /(.)\1{8,}/,
];

export type ModerationScore = {
  score: number;
  flagged: boolean;
  reasons: string[];
  provider?: 'regex' | 'openai';
};

@Injectable()
export class AiModerationService {
  private readonly logger = new Logger(AiModerationService.name);

  constructor(@Optional() private readonly configService?: ConfigService) {}

  scoreSpam(text: string): ModerationScore {
    const reasons: string[] = [];
    let score = 0;
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(text)) {
        score += 0.4;
        reasons.push('pattern_match');
      }
    }
    if (text.length > 800) {
      score += 0.2;
      reasons.push('length');
    }
    const flagged = score >= 0.4;
    return { score: Math.min(1, score), flagged, reasons, provider: 'regex' };
  }

  /** Cascade: regex first; optional OpenAI Moderation API when configured. */
  async scoreContent(text: string): Promise<ModerationScore> {
    const baseline = this.scoreSpam(text);
    if (baseline.flagged) return baseline;

    const apiKey = this.configService?.get<string>('openai.apiKey')?.trim();
    if (!apiKey || text.length < 3) return baseline;

    try {
      const res = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: text.slice(0, 4000), model: 'omni-moderation-latest' }),
      });
      if (!res.ok) return baseline;
      const json = (await res.json()) as {
        results?: Array<{ flagged?: boolean; category_scores?: Record<string, number> }>;
      };
      const result = json.results?.[0];
      if (!result) return baseline;
      const scores = result.category_scores ?? {};
      const maxScore = Math.max(0, ...Object.values(scores));
      const flagged = !!result.flagged || maxScore >= 0.75;
      return {
        score: Math.max(baseline.score, maxScore),
        flagged,
        reasons: flagged ? ['openai_moderation'] : baseline.reasons,
        provider: 'openai',
      };
    } catch (err) {
      this.logger.debug(
        `OpenAI moderation skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
      return baseline;
    }
  }
}
