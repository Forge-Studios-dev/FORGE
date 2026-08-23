import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { VideosService } from '../content/videos.service';
import { ACCOUNT_PURGE_GRACE_PERIOD_DAYS } from './account-purge.constants';

const USERS_PER_SCAN = 200;

@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly videosService: VideosService,
  ) {}

  /**
   * Hard-deletes video assets (S3/Mux/DB) for accounts whose deletedAt is
   * older than the grace period. Idempotent: once an account's videos are
   * gone, later scans find nothing left to purge for that user.
   */
  async runDuePurges(): Promise<{ usersScanned: number; videosPurged: number }> {
    const cutoff = new Date(Date.now() - ACCOUNT_PURGE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const deletedUsers = await this.userRepository.find({
      where: { deletedAt: LessThanOrEqual(cutoff) },
      select: ['id'],
      take: USERS_PER_SCAN,
    });
    if (!deletedUsers.length) return { usersScanned: 0, videosPurged: 0 };

    let videosPurged = 0;
    for (const user of deletedUsers) {
      const videos = await this.videoRepository.find({ where: { userId: user.id } });
      for (const video of videos) {
        try {
          await this.videosService.purgeVideoForDeletedAccount(video);
          videosPurged += 1;
        } catch (err) {
          this.logger.warn(
            `Failed to purge video ${video.id} for deleted account ${user.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    if (videosPurged > 0) {
      this.logger.log(
        `Account purge: hard-deleted ${videosPurged} video(s) across ${deletedUsers.length} account(s) past the ${ACCOUNT_PURGE_GRACE_PERIOD_DAYS}-day grace period`,
      );
    }
    return { usersScanned: deletedUsers.length, videosPurged };
  }
}
