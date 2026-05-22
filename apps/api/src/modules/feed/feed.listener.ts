import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeedService } from './feed.service';

@Injectable()
export class FeedListener {
  constructor(private readonly feedService: FeedService) {}

  @OnEvent('video.ready')
  async onVideoReady(payload: { videoId: string; categoryId?: string | null }) {
    await this.feedService.invalidateFeedCache(payload?.categoryId ?? undefined);
    if (payload?.videoId) await this.feedService.invalidateVideoDetailCache(payload.videoId);
  }

  @OnEvent('video.updated')
  async onVideoUpdated(payload: { videoId?: string }) {
    await this.feedService.invalidateFeedCache();
    if (payload?.videoId) await this.feedService.invalidateVideoDetailCache(payload.videoId);
  }
}

