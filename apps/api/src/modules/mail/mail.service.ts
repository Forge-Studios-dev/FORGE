import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly smtpConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.smtpHost');
    const user = this.configService.get<string>('mail.smtpUser');
    const pass = this.configService.get<string>('mail.smtpPass');
    this.smtpConfigured = Boolean(host && user && pass);
    if (this.smtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('mail.smtpPort') || 587,
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
      const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
      if (nodeEnv === 'production') {
        this.logger.error('SMTP is not configured — transactional email will not be sent in production');
      }
    }
  }

  isConfigured(): boolean {
    return this.smtpConfigured;
  }

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    const from = this.configService.get<string>('mail.from') || 'noreply@localhost';
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';

    if (!this.transporter) {
      const msg = 'Email delivery is not configured. Contact support.';
      if (nodeEnv === 'production') {
        throw new ServiceUnavailableException({
          message: msg,
          code: 'MAIL_NOT_CONFIGURED',
        });
      }
      this.logger.log(`[mail skipped — no SMTP] to=${to} subject=${subject}\n${text}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from, to, subject, text });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP send failed to=${to} subject=${subject}: ${detail}`);
      throw new ServiceUnavailableException({
        message: 'Could not send email. Try again in a few minutes.',
        code: 'MAIL_DELIVERY_FAILED',
      });
    }
  }
}
