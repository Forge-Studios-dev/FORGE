import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.smtpHost');
    const user = this.configService.get<string>('mail.smtpUser');
    const pass = this.configService.get<string>('mail.smtpPass');
    if (host && user && pass) {
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

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    const from = this.configService.get<string>('mail.from') || 'noreply@localhost';
    if (!this.transporter) {
      this.logger.log(`[mail skipped — no SMTP] to=${to} subject=${subject}\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from, to, subject, text });
  }
}
