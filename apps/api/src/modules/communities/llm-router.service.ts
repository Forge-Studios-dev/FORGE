import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiBudgetService } from './ai-budget.service';
import { recordAiLlmCall } from '../../common/metrics/forge-metrics';

export type LlmProvider = 'openai' | 'anthropic';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  maxTokens?: number;
  temperature?: number;
  /** When true, adds prompt caching to Claude system prompt (Anthropic beta feature). */
  cacheSystemPrompt?: boolean;
}

export interface LlmResult {
  text: string;
  provider: LlmProvider;
  cached: boolean;
}

/** Feature → preferred provider mapping. Falls back to alternate if primary not configured. */
const FEATURE_PROVIDER: Record<string, LlmProvider> = {
  summary: 'openai',
  moderation: 'openai',
  judge: 'openai',
  creator_insights: 'anthropic',
  course_outline: 'anthropic',
  content_strategy: 'anthropic',
};

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiBudget: AiBudgetService,
  ) {}

  /**
   * Route an LLM completion to the best available provider for the feature.
   * Returns null when budget is exhausted or both providers fail/unconfigured.
   */
  async complete(
    feature: string,
    systemPrompt: string,
    messages: LlmMessage[],
    options: LlmOptions = {},
  ): Promise<LlmResult | null> {
    const allowed = await this.aiBudget.tryConsume();
    if (!allowed) {
      recordAiLlmCall(this.toMetricFeature(feature), 'budget_skipped');
      return null;
    }

    const preferred = FEATURE_PROVIDER[feature] ?? 'openai';
    const alternate: LlmProvider = preferred === 'openai' ? 'anthropic' : 'openai';

    for (const provider of [preferred, alternate]) {
      const result = await this.callProvider(provider, feature, systemPrompt, messages, options);
      if (result) return result;
    }

    recordAiLlmCall(this.toMetricFeature(feature), 'error');
    return null;
  }

  private async callProvider(
    provider: LlmProvider,
    feature: string,
    systemPrompt: string,
    messages: LlmMessage[],
    options: LlmOptions,
  ): Promise<LlmResult | null> {
    if (provider === 'openai') return this.callOpenAi(feature, systemPrompt, messages, options);
    return this.callAnthropic(feature, systemPrompt, messages, options);
  }

  private async callOpenAi(
    feature: string,
    systemPrompt: string,
    messages: LlmMessage[],
    options: LlmOptions,
  ): Promise<LlmResult | null> {
    const apiKey = this.configService.get<string>('openai.apiKey')?.trim();
    const enabled = this.configService.get<boolean>('ai.copilotEnabled');
    if (!enabled || !apiKey) return null;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.configService.get<string>('ai.copilotModel') ?? 'gpt-4.1-mini',
          max_tokens: options.maxTokens ?? 512,
          temperature: options.temperature ?? 0.3,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) return null;
      recordAiLlmCall(this.toMetricFeature(feature), 'success');
      return { text, provider: 'openai', cached: false };
    } catch (err) {
      this.logger.debug(`OpenAI ${feature} error: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private async callAnthropic(
    feature: string,
    systemPrompt: string,
    messages: LlmMessage[],
    options: LlmOptions,
  ): Promise<LlmResult | null> {
    const apiKey = this.configService.get<string>('anthropic.apiKey')?.trim();
    const enabled = this.configService.get<boolean>('ai.claudeEnabled');
    if (!enabled || !apiKey) return null;

    try {
      const model =
        this.configService.get<string>('ai.claudeModel') ?? 'claude-haiku-4-5-20251001';

      // Prompt caching: wrap system in a content block with cache_control when requested.
      // Anthropic caches prefixes up to and including blocks with cache_control.
      const systemPayload = options.cacheSystemPrompt
        ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
        : systemPrompt;

      const headers: Record<string, string> = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };
      if (options.cacheSystemPrompt) {
        headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens ?? 512,
          system: systemPayload,
          messages,
        }),
      });

      if (!res.ok) return null;
      const json = (await res.json()) as {
        content?: Array<{ type: string; text: string }>;
        usage?: { cache_read_input_tokens?: number };
      };
      const text = json.content?.find((c) => c.type === 'text')?.text?.trim();
      if (!text) return null;
      const cached = (json.usage?.cache_read_input_tokens ?? 0) > 0;
      recordAiLlmCall(this.toMetricFeature(feature), 'success');
      return { text, provider: 'anthropic', cached };
    } catch (err) {
      this.logger.debug(`Anthropic ${feature} error: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private toMetricFeature(feature: string) {
    const valid = ['moderation', 'summary', 'judge', 'creator_insights'];
    return (valid.includes(feature) ? feature : 'creator_insights') as
      | 'moderation'
      | 'summary'
      | 'judge'
      | 'creator_insights';
  }
}
