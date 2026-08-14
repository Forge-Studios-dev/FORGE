import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Notification } from './entities/notification.entity';
import { MailService } from '../mail/mail.service';

const BATCH_SIZE = 200;
const MAX_ITEMS_PER_DIGEST = 20;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailDigestService {
  private readonly logger = new Logger(EmailDigestService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /** Invoked by BullMQ worker (daily repeatable job). */
  async runDigest(): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;
    let offset = 0;

    for (;;) {
      // Bounded batches — this scans every digest-opted-in user, which could
      // be a large table; an unbounded getMany() would load it all at once.
      const users = await this.userRepository
        .createQueryBuilder('u')
        .where("u.notification_preferences ->> 'emailDigest' = 'true'")
        .andWhere('u.is_active = true')
        .orderBy('u.id')
        .skip(offset)
        .take(BATCH_SIZE)
        .getMany();

      if (!users.length) break;
      offset += users.length;

      for (const user of users) {
        try {
          const didSend = await this.sendDigestForUser(user);
          if (didSend) sent++;
          else skipped++;
        } catch (err) {
          skipped++;
          this.logger.warn(
            `Email digest failed for user ${user.id}: ${(err as Error).message}`,
          );
        }
      }

      if (users.length < BATCH_SIZE) break;
    }

    this.logger.log(`Email digest run complete — sent ${sent}, skipped ${skipped}`);
    return { sent, skipped };
  }

  /** Returns true when a digest email was actually sent. */
  private async sendDigestForUser(user: User): Promise<boolean> {
    const since = user.lastEmailDigestSentAt ?? new Date(Date.now() - DEFAULT_LOOKBACK_MS);

    const notifications = await this.notificationRepository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId: user.id })
      .andWhere('n.read_at IS NULL')
      .andWhere('n.created_at > :since', { since })
      .orderBy('n.created_at', 'DESC')
      .take(MAX_ITEMS_PER_DIGEST)
      .getMany();

    if (!notifications.length) return false;

    if (!this.mailService.isConfigured()) {
      this.logger.warn('Email digest skipped for user — mail service not configured');
      return false;
    }

    const webUrl = this.configService.get<string>('mail.webUrl') || 'http://localhost:3000';
    const count = notifications.length;
    const subject = `Your FORGE digest: ${count} new notification${count === 1 ? '' : 's'}`;
    const lines = notifications.map((n) => `- ${n.title}${n.body ? `: ${n.body}` : ''}`);
    const text = [
      "Here's what you missed on FORGE:",
      '',
      ...lines,
      '',
      `Manage your notification preferences: ${webUrl}/profile/settings#notifications`,
    ].join('\n');

    await this.mailService.sendMail(user.email, subject, text);
    await this.userRepository.update(user.id, { lastEmailDigestSentAt: new Date() });
    return true;
  }
}
