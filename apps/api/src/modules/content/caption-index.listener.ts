import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { VideosService } from './videos.service';

/**
 * After Mux (or other) mutates caption_tracks without going through setCaptionUrl,
 * re-fold all language tracks into caption_text for FTS.
 */
@Injectable()
export class CaptionIndexListener {
  private readonly logger = new Logger(CaptionIndexListener.name);

  constructor(private readonly videosService: VideosService) {}

  @OnEvent('video.captions.updated')
  async onCaptionsUpdated(payload: { videoId?: string }): Promise<void> {
    const videoId = payload?.videoId;
    if (!videoId) return;
    try {
      await this.videosService.reindexCaptionSearchText(videoId);
    } catch (err) {
      this.logger.warn(
        `caption index listener failed for ${videoId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
