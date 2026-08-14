import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_DIGEST_QUEUE, EmailDigestJob } from '../../notifications/email-digest.constants';
import { EmailDigestService } from '../../notifications/email-digest.service';

@Processor(EMAIL_DIGEST_QUEUE)
export class EmailDigestWorker extends WorkerHost {
  private readonly logger = new Logger(EmailDigestWorker.name);

  constructor(private readonly emailDigest: EmailDigestService) {
    super();
  }

  async process(_job: Job<EmailDigestJob>): Promise<void> {
    this.logger.debug('Running email digest');
    await this.emailDigest.runDigest();
  }
}
