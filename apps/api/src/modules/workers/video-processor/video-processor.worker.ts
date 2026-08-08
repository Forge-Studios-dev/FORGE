import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Job, Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Video, VideoStatus, VideoType } from '../../content/entities/video.entity';
import { indexedAtOnReady, publishStatusOnReady } from '../../content/video-publish.util';
import { VIDEO_PROCESSING_QUEUE, VIDEO_PROCESSING_DLQ_QUEUE } from '../../content/video-processing.constants';
import { resolveVideoTypeOnReady } from '../../content/short-duration.util';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { buildPublicMediaUrl } from '../../../common/media-url.util';
import { videoDetailCacheKey } from '../../content/video-cache';
import { OWNED_VIDEO_S3_KEY_PATTERN } from '../../content/dto/create-video.dto';

interface VideoProcessingJob {
  videoId: string;
  s3Key: string;
  userId: string;
}

interface HlsRendition {
  resolution: string;
  bitrate: string;
  height: number;
}

const HLS_RENDITIONS: HlsRendition[] = [
  { resolution: '426x240', bitrate: '400k', height: 240 },
  { resolution: '854x480', bitrate: '1000k', height: 480 },
  { resolution: '1280x720', bitrate: '2500k', height: 720 },
  { resolution: '1920x1080', bitrate: '5000k', height: 1080 },
];

@Processor(VIDEO_PROCESSING_QUEUE, { concurrency: 1 })
export class VideoProcessorWorker extends WorkerHost {
  private readonly logger = new Logger(VideoProcessorWorker.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnDomain: string;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectQueue(VIDEO_PROCESSING_DLQ_QUEUE)
    private readonly deadLetterQueue: Queue,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
    this.s3 = new S3Client({
      region: configService.get<string>('aws.region'),
      credentials: {
        accessKeyId: configService.get<string>('aws.accessKeyId') || '',
        secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
      },
    });
    this.bucket = configService.get<string>('aws.s3BucketName') || '';
    this.cdnDomain = configService.get<string>('aws.cloudfrontDomain') || '';
  }

  private mediaUrl(key: string): string {
    return buildPublicMediaUrl(key, {
      cdnDomain: this.cdnDomain,
      bucket: this.bucket,
      region: this.configService.get<string>('aws.region'),
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<VideoProcessingJob>, err: Error) {
    const maxAttempts =
      typeof job.opts.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 5;
    if (job.attemptsMade < maxAttempts) return;
    await this.deadLetterQueue.add(
      'dead',
      {
        ...job.data,
        originalJobId: job.id,
        failedReason: err?.message?.slice(0, 2000) ?? 'Unknown error',
        failedAt: new Date().toISOString(),
      },
      { jobId: `dlq-${job.id}-${Date.now()}` },
    );
    this.logger.warn(
      JSON.stringify({
        msg: 'video_processing_sent_to_dlq',
        videoId: job.data.videoId,
        originalJobId: job.id,
        attemptsMade: job.attemptsMade,
      }),
    );
  }

  async process(job: Job<VideoProcessingJob>): Promise<void> {
    const { videoId, s3Key, userId } = job.data;
    if (!OWNED_VIDEO_S3_KEY_PATTERN.test(s3Key) || !s3Key.startsWith(`videos/${userId}/`)) {
      throw new Error('Refusing to process video with invalid s3Key');
    }
    // Random mkdtemp — never interpolate job fields into the temp path (CodeQL).
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-vid-'));

    this.logger.log(
      JSON.stringify({ msg: 'video_processing_started', videoId, userId }),
    );

    await this.videoRepository.update(videoId, { status: VideoStatus.PROCESSING });

    try {
      const rawFilePath = path.join(tmpDir, 'input.mp4');
      await this.downloadFromS3(s3Key, rawFilePath);

      await job.updateProgress(20);

      const thumbnailPath = path.join(tmpDir, 'thumbnail.jpg');
      const customThumbKey = await this.findCustomThumbnailKey(userId, videoId);
      if (customThumbKey) {
        await this.downloadFromS3(customThumbKey, thumbnailPath);
      } else {
        await this.generateThumbnail(rawFilePath, thumbnailPath);
      }

      await job.updateProgress(35);

      const hlsOutputDir = path.join(tmpDir, 'hls');
      fs.mkdirSync(hlsOutputDir, { recursive: true });

      const duration = await this.getVideoDuration(rawFilePath);
      const row = await this.videoRepository.findOne({
        where: { id: videoId },
        relations: ['skillTags'],
      });
      const typeResolution = resolveVideoTypeOnReady(
        row?.videoType ?? VideoType.VIDEO,
        duration,
      );
      if (!typeResolution.ok) {
        await this.videoRepository.update(videoId, {
          status: VideoStatus.FAILED,
          durationSeconds: duration,
          failureReason: typeResolution.reason,
        });
        await this.redis.del(videoDetailCacheKey(videoId));
        this.eventEmitter.emit('video.updated', { videoId });
        this.logger.warn(
          JSON.stringify({
            msg: 'video_processing_short_too_long',
            videoId,
            duration,
            reason: typeResolution.reason,
          }),
        );
        await job.updateProgress(100);
        return;
      }

      await this.transcodeToHls(rawFilePath, hlsOutputDir, duration, job);

      await job.updateProgress(80);

      const hlsBaseKey = `videos/${videoId}/hls`;
      await this.uploadHlsToS3(hlsOutputDir, hlsBaseKey);

      const thumbnailKey = `videos/${videoId}/thumbnail.jpg`;
      await this.uploadFileToS3(thumbnailPath, thumbnailKey, 'image/jpeg');

      await job.updateProgress(95);

      const hlsUrl = this.mediaUrl(`${hlsBaseKey}/master.m3u8`);
      const thumbnailUrl = this.mediaUrl(thumbnailKey);

      const now = new Date();
      const scheduled = row?.scheduledPublishAt;
      const publishedAt =
        scheduled && scheduled.getTime() > now.getTime() ? scheduled : now;

      const publishStatus = publishStatusOnReady();
      const indexedAt = row
        ? indexedAtOnReady({
            ...row,
            status: VideoStatus.READY,
            publishStatus,
            hlsUrl,
            thumbnailUrl,
            publishedAt,
          })
        : null;

      await this.videoRepository.update(videoId, {
        status: VideoStatus.READY,
        publishStatus,
        hlsUrl,
        thumbnailUrl,
        durationSeconds: duration,
        videoType: typeResolution.videoType,
        publishedAt,
        indexedAt,
      });

      await this.redis.del(videoDetailCacheKey(videoId));
      this.eventEmitter.emit('video.updated', { videoId });
      this.eventEmitter.emit('video.ready', {
        videoId,
        userId,
        categoryId: row?.categoryId ?? null,
        videoType: typeResolution.videoType,
        status: VideoStatus.READY,
        hlsUrl,
        thumbnailUrl,
      });

      await job.updateProgress(100);
      this.logger.log(`Video ${videoId} processed successfully`);
    } catch (err) {
      // attemptsMade is not incremented until after process() throws; BullMQ uses attemptsMade+1 vs opts.attempts for retry.
      const maxAttempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 5;
      const finalFailure = job.attemptsMade + 1 >= maxAttempts;
      const msg = err instanceof Error ? err.message.slice(0, 500) : 'Unknown error';
      this.logger.error(
        JSON.stringify({
          msg: 'video_processing_error',
          videoId,
          attemptsMade: job.attemptsMade,
          maxAttempts,
          finalFailure,
          error: msg,
        }),
      );
      if (finalFailure) {
        await this.videoRepository.update(videoId, {
          status: VideoStatus.FAILED,
          failureReason: msg,
        });
      }
      throw err;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private async findCustomThumbnailKey(userId: string, videoId: string): Promise<string | null> {
    const prefixes = ['thumbnail.custom.jpg', 'thumbnail.custom.png', 'thumbnail.custom.webp'];
    for (const suffix of prefixes) {
      const key = `videos/${userId}/${videoId}/${suffix}`;
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        return key;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  private async downloadFromS3(key: string, destPath: string): Promise<void> {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const stream = response.Body as NodeJS.ReadableStream;
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(destPath);
      stream.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['5%'],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '1280x720',
        })
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });
  }

  private getVideoDuration(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration || 0);
      });
    });
  }

  private transcodeToHls(
    inputPath: string,
    outputDir: string,
    _duration: number,
    job: Job,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const masterPlaylist: string[] = ['#EXTM3U', '#EXT-X-VERSION:3'];
      let completedRenditions = 0;

      const processNextRendition = (index: number) => {
        if (index >= HLS_RENDITIONS.length) {
          const masterContent = masterPlaylist.join('\n');
          fs.writeFileSync(path.join(outputDir, 'master.m3u8'), masterContent);
          return resolve();
        }

        const rendition = HLS_RENDITIONS[index];
        const renditionDir = path.join(outputDir, `${rendition.height}p`);
        fs.mkdirSync(renditionDir, { recursive: true });

        ffmpeg(inputPath)
          .outputOptions([
            `-vf scale=${rendition.resolution}`,
            `-c:v libx264`,
            `-b:v ${rendition.bitrate}`,
            `-c:a aac`,
            `-b:a 128k`,
            `-hls_time 6`,
            `-hls_playlist_type vod`,
            `-hls_segment_filename ${renditionDir}/segment%03d.ts`,
          ])
          .output(path.join(renditionDir, 'index.m3u8'))
          .on('end', () => {
            masterPlaylist.push(
              `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(rendition.bitrate) * 1000},RESOLUTION=${rendition.resolution}`,
              `${rendition.height}p/index.m3u8`,
            );
            completedRenditions++;
            job.updateProgress(35 + Math.floor((completedRenditions / HLS_RENDITIONS.length) * 45));
            processNextRendition(index + 1);
          })
          .on('error', reject)
          .run();
      };

      processNextRendition(0);
    });
  }

  private async uploadHlsToS3(hlsDir: string, s3BaseKey: string): Promise<void> {
    const uploadFile = async (filePath: string, key: string, contentType: string) => {
      const body = fs.readFileSync(filePath);
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: contentType === 'application/x-mpegURL' ? 'no-cache' : 'max-age=31536000',
        }),
      );
    };

    const walkDir = async (dir: string, prefix: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const s3Key = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
          await walkDir(fullPath, s3Key);
        } else {
          const contentType = entry.name.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T';
          await uploadFile(fullPath, s3Key, contentType);
        }
      }
    };

    await walkDir(hlsDir, s3BaseKey);
  }

  private async uploadFileToS3(filePath: string, key: string, contentType: string): Promise<void> {
    const body = fs.readFileSync(filePath);
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }
}
