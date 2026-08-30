import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import Mux from '@mux/mux-node';
import { StreamClip } from '../../streaming/entities/stream-clip.entity';
import { Stream } from '../../streaming/entities/stream.entity';
import {
  STREAM_CLIP_EXPORT_QUEUE,
  STREAM_CLIP_PASSTHROUGH_PREFIX,
  StreamClipExportJob,
} from './stream-clip-export.constants';

@Injectable()
export class StreamClipExportService {
  private readonly logger = new Logger(StreamClipExportService.name);
  private readonly mux: Mux | null;

  constructor(
    @InjectRepository(StreamClip)
    private readonly clipRepository: Repository<StreamClip>,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectQueue(STREAM_CLIP_EXPORT_QUEUE)
    private readonly exportQueue: Queue<StreamClipExportJob>,
    private readonly configService: ConfigService,
  ) {
    const tokenId = this.configService.get<string>('mux.tokenId');
    const tokenSecret = this.configService.get<string>('mux.tokenSecret');
    const configured =
      !!tokenId &&
      !!tokenSecret &&
      tokenId !== 'placeholder' &&
      tokenSecret !== 'placeholder';
    this.mux = configured ? new Mux({ tokenId: tokenId!, tokenSecret: tokenSecret! }) : null;
  }

  async enqueueClip(clipId: string): Promise<void> {
    try {
      await this.exportQueue.add(
        'export',
        { clipId },
        {
          jobId: `clip-export-${clipId}`,
          attempts: 4,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue clip export ${clipId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** After a live recording asset appears, retry markers that never exported. */
  async enqueueMarkedClipsForStream(streamId: string): Promise<void> {
    const clips = await this.clipRepository
      .createQueryBuilder('c')
      .where('c.stream_id = :streamId', { streamId })
      .andWhere('c.playback_url IS NULL')
      .andWhere('c.status IN (:...statuses)', { statuses: ['marked', 'failed'] })
      .take(50)
      .getMany();
    for (const clip of clips) {
      await this.enqueueClip(clip.id);
    }
  }

  async exportClip(clipId: string): Promise<void> {
    const clip = await this.clipRepository.findOne({ where: { id: clipId } });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.playbackUrl && clip.status === 'ready') return;

    const stream = await this.streamRepository.findOne({ where: { id: clip.streamId } });
    if (!stream) throw new NotFoundException('Stream not found');

    if (!stream.muxAssetId) {
      await this.clipRepository.update(clip.id, {
        status: 'marked',
        exportError: null,
      });
      this.logger.log(
        JSON.stringify({
          msg: 'stream_clip_export_deferred',
          clipId,
          streamId: stream.id,
          reason: 'no_source_asset',
        }),
      );
      return;
    }

    if (!this.mux) {
      await this.clipRepository.update(clip.id, {
        status: 'marked',
        exportError: 'Mux credentials not configured',
      });
      return;
    }

    await this.clipRepository.update(clip.id, {
      status: 'exporting',
      exportError: null,
    });

    const startSec = Math.max(0, Number(clip.startOffsetMs) / 1000);
    const endSec = Math.max(startSec + 0.5, Number(clip.endOffsetMs) / 1000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await this.mux.video.assets.create({
        inputs: [
          {
            url: `mux://assets/${stream.muxAssetId}`,
            start_time: startSec,
            end_time: endSec,
          },
        ],
        playback_policy: ['public'],
        passthrough: `${STREAM_CLIP_PASSTHROUGH_PREFIX}${clip.id}`,
      } as any);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const asset = response as any;
      const assetId = asset.id as string | undefined;
      const playbackId = (asset.playback_ids as Array<{ id: string }> | undefined)?.[0]?.id;

      if (!assetId) {
        throw new Error('Mux clip asset create returned no id');
      }

      if (playbackId) {
        await this.clipRepository.update(clip.id, {
          muxClipAssetId: assetId,
          playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
          status: 'ready',
          exportError: null,
        });
      } else {
        // Wait for video.asset.ready webhook to attach playback.
        await this.clipRepository.update(clip.id, {
          muxClipAssetId: assetId,
          status: 'exporting',
          exportError: null,
        });
      }

      this.logger.log(
        JSON.stringify({
          msg: 'stream_clip_export_submitted',
          clipId,
          assetId,
          hasPlayback: !!playbackId,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.clipRepository.update(clip.id, {
        status: 'failed',
        exportError: message.slice(0, 500),
      });
      this.logger.warn(
        JSON.stringify({ msg: 'stream_clip_export_failed', clipId, error: message }),
      );
      throw err;
    }
  }

  async handleClipAssetReady(payload: {
    data?: Record<string, unknown>;
  }): Promise<boolean> {
    const data = payload.data ?? {};
    const passthrough = data.passthrough as string | undefined;
    if (!passthrough?.startsWith(STREAM_CLIP_PASSTHROUGH_PREFIX)) return false;

    const clipId = passthrough.slice(STREAM_CLIP_PASSTHROUGH_PREFIX.length);
    const assetId = data.id as string | undefined;
    const playbackIds =
      (data.playback_ids as Array<{ id: string; policy: string }> | undefined) || [];
    const playbackId = playbackIds[0]?.id;
    if (!clipId || !assetId || !playbackId) return true;

    await this.clipRepository.update(
      { id: clipId },
      {
        muxClipAssetId: assetId,
        playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
        status: 'ready',
        exportError: null,
      },
    );
    this.logger.log(JSON.stringify({ msg: 'stream_clip_export_ready', clipId, assetId }));
    return true;
  }
}
