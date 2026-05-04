import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Mux from '@mux/mux-node';
import { Stream, StreamStatus } from './entities/stream.entity';
import { CreateStreamDto } from './dto/create-stream.dto';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly mux: Mux;

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    private readonly configService: ConfigService,
  ) {
    this.mux = new Mux({
      tokenId: configService.get<string>('mux.tokenId') || 'placeholder',
      tokenSecret: configService.get<string>('mux.tokenSecret') || 'placeholder',
    });
  }

  async createStream(userId: string, dto: CreateStreamDto): Promise<Stream> {
    let muxLiveStreamId = 'mock-stream-id';
    let streamKey = 'mock-stream-key';
    let playbackUrl: string | undefined;

    try {
      const response = await this.mux.video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
        reduced_latency: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response as any;
      muxLiveStreamId = raw.id ?? muxLiveStreamId;
      streamKey = raw.stream_key ?? streamKey;
      if (raw.playback_ids?.[0]?.id) {
        playbackUrl = `https://stream.mux.com/${raw.playback_ids[0].id}.m3u8`;
      }
    } catch (err) {
      this.logger.warn('Mux API unavailable, using mock stream data', err);
    }

    const stream = this.streamRepository.create({
      userId,
      title: dto.title,
      description: dto.description,
      muxLiveStreamId,
      streamKey,
      rtmpUrl: 'rtmps://global-live.mux.com:443/app',
      playbackUrl,
      status: StreamStatus.IDLE,
    });

    return this.streamRepository.save(stream);
  }

  async findById(id: string): Promise<Stream> {
    const stream = await this.streamRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!stream) throw new NotFoundException('Stream not found');
    return stream;
  }

  async getLiveStreams(): Promise<Stream[]> {
    return this.streamRepository.find({
      where: { status: StreamStatus.LIVE },
      relations: ['user'],
      order: { startedAt: 'DESC' },
    });
  }

  async endStream(userId: string, streamId: string): Promise<Stream> {
    const stream = await this.findById(streamId);

    if (stream.userId !== userId) {
      throw new NotFoundException('Stream not found');
    }

    if (stream.muxLiveStreamId && stream.muxLiveStreamId !== 'mock-stream-id') {
      try {
        await this.mux.video.liveStreams.disable(stream.muxLiveStreamId);
      } catch (err) {
        this.logger.warn('Failed to disable Mux stream', err);
      }
    }

    stream.status = StreamStatus.ENDED;
    stream.endedAt = new Date();
    return this.streamRepository.save(stream);
  }

  async handleMuxWebhook(payload: Record<string, unknown>) {
    const eventType = payload.type as string;
    const data = payload.data as Record<string, unknown>;

    if (eventType === 'video.live_stream.active') {
      await this.streamRepository.update(
        { muxLiveStreamId: data.id as string },
        { status: StreamStatus.LIVE, startedAt: new Date() },
      );
    } else if (eventType === 'video.live_stream.idle') {
      await this.streamRepository.update(
        { muxLiveStreamId: data.id as string },
        { status: StreamStatus.IDLE },
      );
    }
  }
}
