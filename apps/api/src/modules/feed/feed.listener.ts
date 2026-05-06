import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeedService } from './feed.service';

@Injectable()
export class FeedListener {
  constructor(private readonly feedService: FeedService) {}

  @OnEvent('video.ready')
  async onVideoReady() {
    await this.feedService.invalidateFeedCache();
  }

  @OnEvent('video.updated')
  async onVideoUpdated() {
    await this.feedService.invalidateFeedCache();
  }
}

