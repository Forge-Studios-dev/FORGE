import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

/**
 * Daily LLM call budget (CEOS-P12-T013). Caps OpenAI calls per UTC day across all
 * AI features using a Redis counter. Fail-open on Redis errors so a cache outage
 * never breaks moderation/copilot — the provider account spend limit is the backstop.
 */
@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private dailyBudget(): number {
    return this.configService.get<number>('ai.dailyLlmBudget') ?? 0;
  }

  private key(): string {
    return `ai:llm:budget:${new Date().toISOString().slice(0, 10)}`;
  }

  /** Reserve `units` LLM calls against today's budget. Returns false when exhausted. */
  async tryConsume(units = 1): Promise<boolean> {
    const budget = this.dailyBudget();
    if (budget <= 0) return true;

    const key = this.key();
    try {
      const used = await this.redis.incrby(key, units);
      if (used === units) {
        await this.redis.expire(key, 172800);
      }
      if (used > budget) {
        await this.redis.decrby(key, units);
        this.logger.warn(`AI daily LLM budget reached (${budget}); skipping LLM call`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `AI budget check failed (fail-open): ${err instanceof Error ? err.message : err}`,
      );
      return true;
    }
  }

  async usage(): Promise<{ used: number; budget: number; remaining: number }> {
    const budget = this.dailyBudget();
    try {
      const used = parseInt((await this.redis.get(this.key())) || '0', 10);
      return { used, budget, remaining: budget > 0 ? Math.max(0, budget - used) : -1 };
    } catch {
      return { used: 0, budget, remaining: budget > 0 ? budget : -1 };
    }
  }
}
