import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PodcastSeries } from './entities/podcast-series.entity';
import { Video, VideoType } from './entities/video.entity';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';

@Injectable()
export class PodcastsService {
  constructor(
    @InjectRepository(PodcastSeries)
    private readonly seriesRepository: Repository<PodcastSeries>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly dataSource: DataSource,
  ) {}

  async createSeries(
    userId: string,
    input: {
      title: string;
      description?: string;
      coverImageUrl?: string;
      category?: string;
      language?: string;
    },
  ): Promise<PodcastSeries> {
    const count = await this.seriesRepository.count({ where: { userId } });
    if (count >= 20) throw new BadRequestException('Maximum 20 podcast series per creator');
    return this.seriesRepository.save(
      this.seriesRepository.create({
        userId,
        title: input.title.trim().slice(0, 200),
        description: input.description?.trim() ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        category: input.category ?? null,
        language: input.language ?? null,
      }),
    );
  }

  async listSeries(
    userId: string,
    opts: { page?: unknown; limit?: unknown } = {},
  ): Promise<{ data: PodcastSeries[] }> {
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    const data = await this.seriesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { data };
  }

  async updateSeries(
    userId: string,
    seriesId: string,
    input: Partial<{
      title: string;
      description: string | null;
      coverImageUrl: string | null;
      category: string | null;
      rssEnabled: boolean;
    }>,
  ): Promise<PodcastSeries> {
    const series = await this.seriesRepository.findOne({ where: { id: seriesId, userId } });
    if (!series) throw new NotFoundException('Podcast series not found');
    if (input.title !== undefined) series.title = input.title.trim().slice(0, 200);
    if (input.description !== undefined) series.description = input.description;
    if (input.coverImageUrl !== undefined) series.coverImageUrl = input.coverImageUrl;
    if (input.category !== undefined) series.category = input.category;
    if (input.rssEnabled !== undefined) series.rssEnabled = input.rssEnabled;
    return this.seriesRepository.save(series);
  }

  async deleteSeries(userId: string, seriesId: string): Promise<void> {
    const series = await this.seriesRepository.findOne({ where: { id: seriesId, userId } });
    if (!series) throw new NotFoundException('Podcast series not found');
    // Detach episodes instead of cascading delete
    await this.videoRepository.update({ podcastSeriesId: seriesId }, { podcastSeriesId: null });
    await this.seriesRepository.delete(seriesId);
  }

  async listEpisodes(
    seriesId: string,
    _viewerId?: string,
  ): Promise<{ series: PodcastSeries; episodes: Partial<Video>[] }> {
    const series = await this.seriesRepository.findOne({ where: { id: seriesId } });
    if (!series) throw new NotFoundException('Podcast series not found');

    const episodes = await this.videoRepository.find({
      where: { podcastSeriesId: seriesId, videoType: VideoType.PODCAST },
      order: { season: 'ASC', episodeNumber: 'ASC', createdAt: 'ASC' },
      select: [
        'id', 'title', 'description', 'durationSeconds', 'episodeNumber', 'season',
        'showNotes', 'hlsUrl', 'createdAt', 'requiredTierId',
      ],
    });

    return { series, episodes };
  }

  async addEpisodeToSeries(
    userId: string,
    seriesId: string,
    videoId: string,
    input: { episodeNumber?: number; season?: number; showNotes?: string },
  ): Promise<Video> {
    const series = await this.seriesRepository.findOne({ where: { id: seriesId, userId } });
    if (!series) throw new NotFoundException('Podcast series not found');

    const video = await this.videoRepository.findOne({ where: { id: videoId, userId } });
    if (!video) throw new NotFoundException('Video not found');

    video.podcastSeriesId = seriesId;
    video.videoType = VideoType.PODCAST;
    if (input.episodeNumber !== undefined) video.episodeNumber = input.episodeNumber;
    if (input.season !== undefined) video.season = input.season;
    if (input.showNotes !== undefined) video.showNotes = input.showNotes?.slice(0, 10000) ?? null;

    return this.videoRepository.save(video);
  }

  async generateRssFeed(seriesId: string, baseUrl: string): Promise<string> {
    const series = await this.seriesRepository.findOne({ where: { id: seriesId } });
    if (!series) throw new NotFoundException('Podcast series not found');
    if (!series.rssEnabled) throw new ForbiddenException('RSS feed is disabled for this podcast');

    const { episodes } = await this.listEpisodes(seriesId);
    const pubicEpisodes = (episodes as Video[]).filter((e) => !e.requiredTierId);

    const items = pubicEpisodes
      .map((ep) => {
        const url = `${baseUrl}/api/v1/podcasts/${seriesId}/episodes/${ep.id}`;
        return `    <item>
      <title><![CDATA[${ep.title ?? 'Episode'}]]></title>
      <description><![CDATA[${ep.showNotes ?? ep.description ?? ''}]]></description>
      <pubDate>${ep.createdAt?.toUTCString() ?? ''}</pubDate>
      <enclosure url="${url}" type="audio/mpeg"/>
      <guid>${ep.id}</guid>
      ${ep.episodeNumber ? `<itunes:episode>${ep.episodeNumber}</itunes:episode>` : ''}
      ${ep.season ? `<itunes:season>${ep.season}</itunes:season>` : ''}
      ${ep.durationSeconds ? `<itunes:duration>${Math.round(ep.durationSeconds)}</itunes:duration>` : ''}
    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title><![CDATA[${series.title}]]></title>
    <description><![CDATA[${series.description ?? ''}]]></description>
    <language>${series.language ?? 'en'}</language>
    ${series.coverImageUrl ? `<image><url>${series.coverImageUrl}</url></image>
    <itunes:image href="${series.coverImageUrl}"/>` : ''}
    ${series.category ? `<itunes:category text="${series.category}"/>` : ''}
${items}
  </channel>
</rss>`;
  }
}
