import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModerationService } from './ai-moderation.service';

@Injectable()
export class CreatorCopilotService {
  private readonly logger = new Logger(CreatorCopilotService.name);

  constructor(
    private readonly aiModeration: AiModerationService,
    private readonly configService: ConfigService,
  ) {}

  /** Async LLM judge for moderation queue tail (~2–5% flagged content). */
  async judgeFlaggedContent(text: string): Promise<{
    confirmed: boolean;
    score: number;
    reason: string;
  }> {
    const llmEnabled = this.configService.get<boolean>('ai.moderationLlmEnabled');
    if (!llmEnabled) {
      return { confirmed: false, score: 0, reason: 'llm_disabled_skip_judge' };
    }

    const result = await this.aiModeration.scoreContent(text);
    return {
      confirmed: result.flagged,
      score: result.score,
      reason: result.reasons.join(', ') || 'openai_moderation',
    };
  }
}
