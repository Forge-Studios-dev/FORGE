import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';

const REACTION_TTL_SEC = 3600;

@Injectable()
export class StreamReactionService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private typesKey(streamId: string): string {
    return `stream:reactions:types:${streamId}`;
  }

  private countKey(streamId: string, reaction: string): string {
    return `stream:reactions:${streamId}:${reaction}`;
  }

  async react(streamId: string, reaction: string): Promise<{ reaction: string; count: number }> {
    const safeReaction = reaction.slice(0, 32) || 'heart';
    const key = this.countKey(streamId, safeReaction);
    const count = await this.redis.incr(key);
    await this.redis.expire(key, REACTION_TTL_SEC);
    await this.redis.sadd(this.typesKey(streamId), safeReaction);
    await this.redis.expire(this.typesKey(streamId), REACTION_TTL_SEC);

    this.eventEmitter.emit('stream.reaction', { streamId, reaction: safeReaction, count });
    return { reaction: safeReaction, count };
  }

  async getCounts(streamId: string): Promise<Record<string, number>> {
    const types = await this.redis.smembers(this.typesKey(streamId));
    if (!types.length) return {};

    const keys = types.map((t) => this.countKey(streamId, t));
    const values = await this.redis.mget(...keys);
    const result: Record<string, number> = {};
    types.forEach((reaction, i) => {
      result[reaction] = parseInt(values[i] ?? '0', 10) || 0;
    });
    return result;
  }
}
