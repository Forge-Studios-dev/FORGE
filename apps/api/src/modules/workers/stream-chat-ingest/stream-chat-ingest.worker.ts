import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { StreamMessage, StreamMessageType } from '../../stream-chat/entities/stream-message.entity';
import { toPublicStreamMessage } from '../../stream-chat/stream-chat.mapper';
import { safeRedisDel } from '../../../common/redis/redis-safe.util';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { STREAM_CHAT_INGEST_QUEUE } from './stream-chat-ingest.constants';
import { moderateChatMessage } from '../../../common/chat/ai-moderation.util';

export type StreamChatIngestJob = {
  streamId: string;
  userId: string;
  body: string;
  parentId?: string | null;
  messageId: string;
  streamOffsetMs?: number | null;
  messageType?: StreamMessageType;
  amountCents?: number | null;
  highlightSeconds?: number | null;
};

@Processor(STREAM_CHAT_INGEST_QUEUE)
export class StreamChatIngestWorker extends WorkerHost {
  private readonly logger = new Logger(StreamChatIngestWorker.name);

  constructor(
    @InjectRepository(StreamMessage)
    private readonly messageRepository: Repository<StreamMessage>,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<StreamChatIngestJob>): Promise<void> {
    const {
      streamId,
      userId,
      body,
      parentId,
      messageId,
      streamOffsetMs,
      messageType,
      amountCents,
      highlightSeconds,
    } = job.data;

    const moderation = await moderateChatMessage(body, {
      enabled: this.configService.get<boolean>('stream.aiModerationEnabled') !== false,
      openAiKey: this.configService.get<string>('openai.apiKey'),
    });
    if (!moderation.allowed) {
      this.logger.debug(`Chat message ${messageId} blocked by AI moderation`);
      return;
    }

    const existing = await this.messageRepository.findOne({ where: { id: messageId } });
    if (existing) return;

    const saved = await this.messageRepository.save(
      this.messageRepository.create({
        id: messageId,
        streamId,
        userId,
        body,
        parentId: parentId ?? null,
        streamOffsetMs: streamOffsetMs ?? null,
        messageType: messageType ?? StreamMessageType.CHAT,
        amountCents: amountCents ?? null,
        highlightSeconds: highlightSeconds ?? null,
      }),
    );

    const full = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    if (!full) return;

    await safeRedisDel(this.redis, `stream:chat:page:${streamId}`, this.logger);
    const publicMsg = toPublicStreamMessage(full);
    this.eventEmitter.emit('stream.chat.message', { streamId, message: publicMsg });
  }
}
