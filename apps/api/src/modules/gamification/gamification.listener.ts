import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GamificationService } from './gamification.service';

type CommunityActivityPayload = {
  userId: string;
  communityId: string;
  xp: number;
  source: string;
};

@Injectable()
export class GamificationListener {
  private readonly logger = new Logger(GamificationListener.name);

  constructor(private readonly gamificationService: GamificationService) {}

  @OnEvent('community.activity', { async: true })
  async onCommunityActivity(payload: CommunityActivityPayload): Promise<void> {
    if (!payload.userId || !payload.communityId || !payload.xp) return;
    try {
      await this.gamificationService.awardXp(payload.userId, payload.communityId, payload.xp);
    } catch (err) {
      this.logger.warn(
        `XP award failed (${payload.source}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
