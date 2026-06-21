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
    return this.heuristicLayer(text, base);
  }

  /** Async cascade including OpenAI Moderation API when configured. */
  async scoreContentAsync(text: string): Promise<MlModerationResult> {
    const openAi = await this.regexModeration.scoreContent(text);
    const base = {
      score: openAi.score,
      flagged: openAi.flagged,
      reasons: openAi.reasons,
    };
    const layered = this.heuristicLayer(text, base);
    if (openAi.provider === 'openai') {
      return { ...layered, model: 'llm' };
    }
    return layered;
  }

  private heuristicLayer(
    text: string,
    base: { score: number; flagged: boolean; reasons: string[] },
  ): MlModerationResult {
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

    return {
      score,
      flagged,
      reasons,
      model: score > base.score ? 'heuristic-ml' : 'regex',
    };
  }

  /** Creator copilot: community health from recent analytics signals (no LLM). */
  communityHealthScore(input: {
    messagesLast7Days: number;
    activeMembersLast7Days: number;
    postsLast7Days: number;
    retentionRate?: number;
  }): { score: number; label: string; tips: string[] } {
    let score = 50;
    const tips: string[] = [];
    if (input.messagesLast7Days > 100) score += 15;
    else tips.push('Boost chat with a weekly prompt or live session');
    if (input.activeMembersLast7Days > 10) score += 15;
    else tips.push('Re-engage inactive members with announcements');
    if (input.postsLast7Days > 3) score += 10;
    else tips.push('Publish more creator updates or polls');
    if (input.retentionRate != null && input.retentionRate > 0.4) score += 10;
    score = Math.min(100, Math.max(0, score));
    const label = score >= 75 ? 'healthy' : score >= 50 ? 'stable' : 'needs_attention';
    return { score, label, tips };
  }

  /** Cost-guarded discussion summary — LLM when enabled, deterministic fallback otherwise. */
  async summarizeDiscussionAsync(messages: string[], maxLines = 5): Promise<string> {
    if (!messages.length) return 'No discussion activity yet.';
    const copilotEnabled = this.configService.get<boolean>('ai.copilotEnabled');
    const apiKey = this.configService.get<string>('openai.apiKey')?.trim();
    if (copilotEnabled && apiKey) {
      try {
        const transcript = messages
          .slice(-40)
          .map((m, i) => `${i + 1}. ${m.slice(0, 500)}`)
          .join('\n');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.configService.get<string>('ai.copilotModel') ?? 'gpt-4.1-mini',
            max_tokens: 280,
            temperature: 0.3,
            messages: [
              {
                role: 'system',
                content:
                  'Summarize this community text room discussion in 3-5 bullet points for the creator. Be concise.',
              },
              { role: 'user', content: transcript },
            ],
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = json.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        }
      } catch (err) {
        this.logger.debug(
          `LLM summary fallback: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return this.summarizeDiscussion(messages, maxLines);
  }

  /** Deterministic discussion summary fallback. */
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
