import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModerationService } from './ai-moderation.service';
import { AiBudgetService } from './ai-budget.service';
import { recordAiLlmCall } from '../../common/metrics/forge-metrics';

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
    @Optional() private readonly aiBudget?: AiBudgetService,
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
      const allowed = !this.aiBudget || (await this.aiBudget.tryConsume());
      if (!allowed) {
        recordAiLlmCall('summary', 'budget_skipped');
      } else {
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
            if (content) {
              recordAiLlmCall('summary', 'success');
              return content;
            }
          }
          recordAiLlmCall('summary', 'error');
        } catch (err) {
          recordAiLlmCall('summary', 'error');
          this.logger.debug(
            `LLM summary fallback: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    return this.summarizeDiscussion(messages, maxLines);
  }

  /**
   * Claude-powered creator insights.
   * Accepts creator analytics and returns structured recommendations.
   * Falls back to deterministic tips when Claude is not configured.
   */
  async generateCreatorInsights(data: {
    totalSubscribers: number;
    mrr: number;
    churnRate?: number;
    videoViews: number;
    lessonCompletionRate?: number;
    communityEngagement?: number;
    topContentTitles?: string[];
  }): Promise<{
    summary: string;
    recommendations: string[];
    growthFocus: string;
    provider: 'claude' | 'deterministic';
  }> {
    const claudeEnabled = this.configService.get<boolean>('ai.claudeEnabled');
    const apiKey = this.configService.get<string>('anthropic.apiKey')?.trim();

    if (claudeEnabled && apiKey) {
      const allowed = !this.aiBudget || (await this.aiBudget.tryConsume());
      if (allowed) {
        try {
          const model =
            this.configService.get<string>('ai.claudeModel') ?? 'claude-haiku-4-5-20251001';

          const prompt = [
            `Creator analytics snapshot:`,
            `- Subscribers: ${data.totalSubscribers}`,
            `- MRR: $${data.mrr.toFixed(2)}`,
            data.churnRate != null ? `- Monthly churn: ${(data.churnRate * 100).toFixed(1)}%` : '',
            `- Video views (30d): ${data.videoViews}`,
            data.lessonCompletionRate != null
              ? `- Course lesson completion: ${(data.lessonCompletionRate * 100).toFixed(0)}%`
              : '',
            data.communityEngagement != null
              ? `- Community engagement score: ${data.communityEngagement}/100`
              : '',
            data.topContentTitles?.length
              ? `- Top content: ${data.topContentTitles.slice(0, 3).join(', ')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n');

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model,
              max_tokens: 500,
              system:
                'You are a creator economy expert. Analyze creator metrics and return a JSON object with: summary (1-2 sentences), recommendations (array of 3 concise strings), growthFocus (single most impactful action). Only JSON, no prose.',
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          if (res.ok) {
            const json = (await res.json()) as {
              content?: Array<{ type: string; text: string }>;
            };
            const text = json.content?.find((c) => c.type === 'text')?.text?.trim();
            if (text) {
              try {
                const parsed = JSON.parse(text) as {
                  summary?: string;
                  recommendations?: string[];
                  growthFocus?: string;
                };
                if (parsed.summary && Array.isArray(parsed.recommendations)) {
                  recordAiLlmCall('creator_insights', 'success');
                  return {
                    summary: parsed.summary,
                    recommendations: parsed.recommendations.slice(0, 5),
                    growthFocus: parsed.growthFocus ?? '',
                    provider: 'claude',
                  };
                }
              } catch {
                // JSON parse failed — fall through to deterministic
              }
            }
          }
          recordAiLlmCall('creator_insights', 'error');
        } catch (err) {
          recordAiLlmCall('creator_insights', 'error');
          this.logger.debug(
            `Claude insights fallback: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        recordAiLlmCall('creator_insights', 'budget_skipped');
      }
    }

    return this.deterministicInsights(data);
  }

  private deterministicInsights(data: {
    totalSubscribers: number;
    mrr: number;
    churnRate?: number;
    videoViews: number;
    lessonCompletionRate?: number;
    communityEngagement?: number;
  }): {
    summary: string;
    recommendations: string[];
    growthFocus: string;
    provider: 'deterministic';
  } {
    const recommendations: string[] = [];
    let growthFocus = 'Grow subscriber base with consistent content publishing';

    if (data.churnRate != null && data.churnRate > 0.08) {
      recommendations.push('Reduce churn: add exclusive members-only content or events');
      growthFocus = 'Retention — reduce monthly churn below 5%';
    }
    if (data.totalSubscribers < 100) {
      recommendations.push('Grow audience: publish 3+ videos/week and engage in community');
    }
    if (data.videoViews < 500) {
      recommendations.push('Boost discoverability: optimize titles and skill tags');
    }
    if (data.lessonCompletionRate != null && data.lessonCompletionRate < 0.4) {
      recommendations.push('Improve course completion: shorten lessons and add quizzes');
    }
    if (data.communityEngagement != null && data.communityEngagement < 50) {
      recommendations.push('Increase community engagement: run weekly polls or challenges');
    }
    if (recommendations.length === 0) {
      recommendations.push('Keep publishing consistently to maintain momentum');
      recommendations.push('Experiment with live streams to boost subscriber engagement');
    }

    const summary =
      `${data.totalSubscribers} subscribers · $${data.mrr.toFixed(0)} MRR. ` +
      (data.churnRate != null && data.churnRate > 0.08
        ? 'Churn is elevated — retention is the top priority.'
        : 'Growth metrics are on track.');

    return { summary, recommendations, growthFocus, provider: 'deterministic' };
  }

  /**
   * Generate an AI summary for a completed or active live stream.
   * Uses Claude (preferred), then OpenAI, then deterministic fallback.
   */
  async generateStreamSummary(opts: {
    title: string;
    chatMessages: string[];
    qaQuestions?: string[];
    peakViewers?: number;
    durationMinutes?: number;
  }): Promise<{ summary: string; highlights: string[]; provider: 'claude' | 'openai' | 'deterministic' }> {
    const { title, chatMessages, qaQuestions = [], peakViewers, durationMinutes } = opts;

    if (!chatMessages.length && !qaQuestions.length) {
      return {
        summary: 'No stream activity recorded.',
        highlights: [],
        provider: 'deterministic',
      };
    }

    const context = [
      `Stream: "${title}"`,
      peakViewers != null ? `Peak viewers: ${peakViewers}` : '',
      durationMinutes != null ? `Duration: ${durationMinutes} min` : '',
      chatMessages.length ? `Chat messages (${chatMessages.length} total, sample below):` : '',
      ...chatMessages.slice(-30).map((m, i) => `${i + 1}. ${m.slice(0, 300)}`),
      qaQuestions.length ? `\nTop Q&A questions:` : '',
      ...qaQuestions.slice(0, 10).map((q, i) => `Q${i + 1}. ${q.slice(0, 200)}`),
    ].filter(Boolean).join('\n');

    // Try Claude first
    const claudeEnabled = this.configService.get<boolean>('ai.claudeEnabled');
    const claudeKey = this.configService.get<string>('anthropic.apiKey')?.trim();
    if (claudeEnabled && claudeKey) {
      const allowed = !this.aiBudget || (await this.aiBudget.tryConsume());
      if (allowed) {
        try {
          const model = this.configService.get<string>('ai.claudeModel') ?? 'claude-haiku-4-5-20251001';
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model,
              max_tokens: 400,
              system: 'You are a live stream analyst. Return JSON with: summary (2-3 sentences), highlights (array of up to 5 key moments or themes). JSON only.',
              messages: [{ role: 'user', content: context }],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { content?: Array<{ type: string; text: string }> };
            const text = json.content?.find((c) => c.type === 'text')?.text?.trim();
            if (text) {
              try {
                const parsed = JSON.parse(text) as { summary?: string; highlights?: string[] };
                if (parsed.summary) {
                  recordAiLlmCall('stream_summary', 'success');
                  return { summary: parsed.summary, highlights: parsed.highlights ?? [], provider: 'claude' };
                }
              } catch { /* fall through */ }
            }
          }
          recordAiLlmCall('stream_summary', 'error');
        } catch (err) {
          recordAiLlmCall('stream_summary', 'error');
          this.logger.debug(`Stream summary Claude fallback: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        recordAiLlmCall('stream_summary', 'budget_skipped');
      }
    }

    // Try OpenAI fallback
    const openAiKey = this.configService.get<string>('openai.apiKey')?.trim();
    const copilotEnabled = this.configService.get<boolean>('ai.copilotEnabled');
    if (copilotEnabled && openAiKey) {
      const allowed = !this.aiBudget || (await this.aiBudget.tryConsume());
      if (allowed) {
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: this.configService.get<string>('ai.copilotModel') ?? 'gpt-4.1-mini',
              max_tokens: 350,
              temperature: 0.3,
              messages: [
                { role: 'system', content: 'Summarize this live stream in JSON: {summary: string, highlights: string[]}. JSON only.' },
                { role: 'user', content: context },
              ],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
            const raw = json.choices?.[0]?.message?.content?.trim();
            if (raw) {
              try {
                const parsed = JSON.parse(raw) as { summary?: string; highlights?: string[] };
                if (parsed.summary) {
                  recordAiLlmCall('stream_summary', 'success');
                  return { summary: parsed.summary, highlights: parsed.highlights ?? [], provider: 'openai' };
                }
              } catch { /* fall through */ }
            }
          }
          recordAiLlmCall('stream_summary', 'error');
        } catch (err) {
          recordAiLlmCall('stream_summary', 'error');
          this.logger.debug(`Stream summary OpenAI fallback: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Deterministic fallback
    const wordFreq = new Map<string, number>();
    for (const msg of chatMessages.slice(-60)) {
      for (const word of msg.toLowerCase().split(/\W+/).filter((w) => w.length > 4)) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }
    const topTerms = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
    const summary = [
      `Stream "${title}" had ${chatMessages.length} chat messages`,
      peakViewers != null ? ` with ${peakViewers} peak viewers` : '',
      durationMinutes != null ? ` over ${durationMinutes} minutes` : '',
      topTerms.length ? `. Top themes: ${topTerms.join(', ')}.` : '.',
    ].join('');
    const highlights = qaQuestions.slice(0, 5).map((q) => `Q: ${q.slice(0, 100)}`);
    return { summary, highlights, provider: 'deterministic' };
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
