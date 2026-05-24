import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isFeatureEnabled, parseFeatureFlags } from '@forge/shared-types';
import { Video } from './entities/video.entity';
import { VideoMultipartSession } from './entities/video-multipart-session.entity';
import {
  MULTIPART_MAX_PARTS_PER_REQUEST,
  MULTIPART_MIN_FILE_BYTES,
  MULTIPART_PART_SIZE_BYTES,
  MULTIPART_POSTGRES_TTL_SEC,
  MULTIPART_REDIS_PREFIX,
  MULTIPART_REDIS_TTL_SEC,
  type MultipartCompletedPart,
  type MultipartUploadState,
} from './video-multipart.constants';
import type { S3Client } from '@aws-sdk/client-s3';
import {
  safeRedisDel,
  safeRedisGet,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';

@Injectable()
export class VideoMultipartService {
  private readonly logger = new Logger(VideoMultipartService.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    @InjectRepository(VideoMultipartSession)
    private readonly sessionRepository: Repository<VideoMultipartSession>,
  ) {}

  isEnabledForSize(fileSizeBytes: number): boolean {
    const flags = parseFeatureFlags(this.configService.get<string>('featureFlags'));
    return (
      isFeatureEnabled(flags, 'multipart_upload') && fileSizeBytes >= MULTIPART_MIN_FILE_BYTES
    );
  }

  redisKey(videoId: string): string {
    return `${MULTIPART_REDIS_PREFIX}${videoId}`;
  }

  private postgresExpiresAt(): Date {
    return new Date(Date.now() + MULTIPART_POSTGRES_TTL_SEC * 1000);
  }

  async saveState(videoId: string, state: MultipartUploadState): Promise<void> {
    await safeRedisSetex(
      this.redis,
      this.redisKey(videoId),
      MULTIPART_REDIS_TTL_SEC,
      JSON.stringify(state),
      this.logger,
    );
    try {
      await this.sessionRepository.save({
        videoId,
        userId: state.userId,
        state,
        expiresAt: this.postgresExpiresAt(),
      });
    } catch (err) {
      this.logger.warn(
        `multipart postgres save failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async loadState(videoId: string): Promise<MultipartUploadState | null> {
    const raw = await safeRedisGet(this.redis, this.redisKey(videoId), this.logger);
    if (raw) {
      try {
        return JSON.parse(raw) as MultipartUploadState;
      } catch (err) {
        this.logger.warn(
          `multipart redis parse failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    try {
      const row = await this.sessionRepository.findOne({ where: { videoId } });
      if (!row || row.expiresAt.getTime() <= Date.now()) {
        if (row) await this.sessionRepository.delete({ videoId });
        return null;
      }

      await safeRedisSetex(
        this.redis,
        this.redisKey(videoId),
        MULTIPART_REDIS_TTL_SEC,
        JSON.stringify(row.state),
        this.logger,
      );
      return row.state;
    } catch (err) {
      this.logger.warn(
        `multipart postgres load failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async clearState(videoId: string): Promise<void> {
    await safeRedisDel(this.redis, this.redisKey(videoId), this.logger);
    try {
      await this.sessionRepository.delete({ videoId });
    } catch (err) {
      this.logger.warn(
        `multipart postgres delete failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  partCountForFileSize(fileSizeBytes: number): number {
    return Math.ceil(fileSizeBytes / MULTIPART_PART_SIZE_BYTES);
  }

  mergeCompletedParts(
    existing: MultipartCompletedPart[] | undefined,
    incoming: MultipartCompletedPart[],
    partCount: number,
  ): MultipartCompletedPart[] {
    const map = new Map<number, string>();
    for (const p of existing ?? []) {
      if (p.partNumber < 1 || p.partNumber > partCount) {
        throw new BadRequestException(`Invalid stored part number ${p.partNumber}`);
      }
      map.set(p.partNumber, p.etag);
    }
    for (const p of incoming) {
      if (p.partNumber < 1 || p.partNumber > partCount) {
        throw new BadRequestException(`Invalid part number ${p.partNumber}`);
      }
      map.set(p.partNumber, p.etag);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([partNumber, etag]) => ({ partNumber, etag }));
  }

  async getProgress(userId: string, videoId: string) {
    const state = await this.loadState(videoId);
    if (!state) throw new BadRequestException('Multipart session expired or not found');
    if (state.userId !== userId) throw new ForbiddenException();
    const completed = state.completedParts ?? [];
    return {
      videoId,
      partSize: state.partSize,
      partCount: state.partCount,
      completedParts: completed,
      completedCount: completed.length,
    };
  }

  async checkpoint(
    userId: string,
    videoId: string,
    parts: MultipartCompletedPart[],
  ) {
    const state = await this.loadState(videoId);
    if (!state) throw new BadRequestException('Multipart session expired or not found');
    if (state.userId !== userId) throw new ForbiddenException();

    state.completedParts = this.mergeCompletedParts(state.completedParts, parts, state.partCount);
    await this.saveState(videoId, state);
    return {
      completedCount: state.completedParts.length,
      partCount: state.partCount,
    };
  }

  async initiate(
    presignS3: S3Client,
    bucket: string,
    userId: string,
    video: Video,
    contentType: string,
    fileSizeBytes: number,
  ) {
    const partCount = this.partCountForFileSize(fileSizeBytes);
    const create = await presignS3.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: video.s3Key!,
        ContentType: contentType,
      }),
    );
    if (!create.UploadId) {
      throw new BadRequestException('Failed to start multipart upload');
    }

    const state: MultipartUploadState = {
      userId,
      uploadId: create.UploadId,
      key: video.s3Key!,
      contentType,
      partSize: MULTIPART_PART_SIZE_BYTES,
      partCount,
    };
    await this.saveState(video.id, state);

    return {
      videoId: video.id,
      uploadMode: 'multipart' as const,
      key: video.s3Key,
      uploadId: create.UploadId,
      partSize: MULTIPART_PART_SIZE_BYTES,
      partCount,
      expiresIn: 600,
    };
  }

  async signParts(
    presignS3: S3Client,
    bucket: string,
    userId: string,
    videoId: string,
    partNumbers: number[],
  ) {
    const unique = [...new Set(partNumbers)].slice(0, MULTIPART_MAX_PARTS_PER_REQUEST);
    const state = await this.loadState(videoId);
    if (!state) throw new BadRequestException('Multipart session expired or not found');
    if (state.userId !== userId) throw new ForbiddenException();

    for (const n of unique) {
      if (n < 1 || n > state.partCount) {
        throw new BadRequestException(`Invalid part number ${n}`);
      }
    }

    const parts = await Promise.all(
      unique.map(async (partNumber) => {
        const uploadUrl = await getSignedUrl(
          presignS3,
          new UploadPartCommand({
            Bucket: bucket,
            Key: state.key,
            UploadId: state.uploadId,
            PartNumber: partNumber,
          }),
          { expiresIn: 600 },
        );
        return { partNumber, uploadUrl };
      }),
    );

    return { parts, partSize: state.partSize, partCount: state.partCount };
  }

  async completeParts(
    s3: S3Client,
    bucket: string,
    userId: string,
    videoId: string,
    parts: { partNumber: number; etag: string }[],
  ) {
    const state = await this.loadState(videoId);
    if (!state) throw new BadRequestException('Multipart session expired or not found');
    if (state.userId !== userId) throw new ForbiddenException();

    const resolved =
      parts.length > 0
        ? this.mergeCompletedParts(state.completedParts, parts, state.partCount)
        : (state.completedParts ?? []);

    if (resolved.length !== state.partCount) {
      throw new BadRequestException(
        `Expected ${state.partCount} parts, have ${resolved.length} (checkpoint or send all parts)`,
      );
    }

    const normalized = resolved
      .map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag.includes('"') ? p.etag : `"${p.etag}"`,
      }))
      .sort((a, b) => a.PartNumber - b.PartNumber);

    for (let i = 0; i < state.partCount; i++) {
      if (normalized[i]?.PartNumber !== i + 1) {
        throw new BadRequestException('Missing or duplicate part numbers');
      }
    }

    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: state.key,
        UploadId: state.uploadId,
        MultipartUpload: { Parts: normalized },
      }),
    );

    await this.clearState(videoId);
    return { ok: true, key: state.key };
  }

  async abortIfAny(s3: S3Client, bucket: string, videoId: string, key: string | null): Promise<void> {
    const state = await this.loadState(videoId);
    if (!state) return;
    try {
      await s3.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key || state.key,
          UploadId: state.uploadId,
        }),
      );
    } catch {
      /* ignore */
    }
    await this.clearState(videoId);
  }
}
