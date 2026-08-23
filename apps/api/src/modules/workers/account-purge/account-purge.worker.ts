import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ACCOUNT_PURGE_QUEUE, AccountPurgeJob } from '../../users/account-purge.constants';
import { AccountPurgeService } from '../../users/account-purge.service';

@Processor(ACCOUNT_PURGE_QUEUE)
export class AccountPurgeWorker extends WorkerHost {
  private readonly logger = new Logger(AccountPurgeWorker.name);

  constructor(private readonly accountPurgeService: AccountPurgeService) {
    super();
  }

  async process(_job: Job<AccountPurgeJob>): Promise<void> {
    const { videosPurged } = await this.accountPurgeService.runDuePurges();
    if (videosPurged > 0) {
      this.logger.log(`Account purge scan hard-deleted ${videosPurged} video(s)`);
    }
  }
}
