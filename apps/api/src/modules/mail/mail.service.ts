import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/** Hostname equality for Resend SMTP (avoids substring host spoofing). */
function isResendSmtpHost(host: string): boolean {
  const hostname = host.trim().toLowerCase().replace(/^\[|\]$/g, '').split(':')[0];
  return (
    hostname === 'smtp.resend.com' ||
    hostname === 'resend.com' ||
    hostname.endsWith('.resend.com')
  );
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly smtpConfigured: boolean;
  private readonly resendApiKey: string | null;
  private readonly useResendHttp: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.smtpHost') || '';
    const user = this.configService.get<string>('mail.smtpUser') || '';
    const pass = this.configService.get<string>('mail.smtpPass') || '';
    const explicitResend = this.configService.get<string>('mail.resendApiKey') || '';
    this.resendApiKey =
      explicitResend && !explicitResend.includes('YOUR_')
        ? explicitResend
        : pass.startsWith('re_')
          ? pass
          : null;
    this.useResendHttp =
      Boolean(this.resendApiKey) &&
      (isResendSmtpHost(host) || Boolean(explicitResend));

    this.smtpConfigured = Boolean(host && user && pass);
    if (this.smtpConfigured && !this.useResendHttp) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('mail.smtpPort') || 587,
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
    }

    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    if (nodeEnv === 'production' && !this.useResendHttp && !this.transporter) {
      this.logger.error('Email is not configured — set Resend API key (SMTP_PASS=re_...) on Fly');
    }
  }

  isConfigured(): boolean {
    return this.useResendHttp || this.smtpConfigured;
  }

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    const from = this.configService.get<string>('mail.from') || 'noreply@localhost';
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';

    if (!this.useResendHttp && !this.transporter) {
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
      if (this.useResendHttp && this.resendApiKey) {
        await this.sendViaResendHttp(from, to, subject, text, this.resendApiKey);
        return;
      }
      await this.transporter!.sendMail({ from, to, subject, text });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Mail send failed to=${to} subject=${subject}: ${detail}`);
      const authFailed =
        /535|authentication|invalid api key|unauthorized|401/i.test(detail);
      const domainNotVerified = /domain is not verified|verify your domain/i.test(
        detail,
      );
      throw new ServiceUnavailableException({
        message: authFailed
          ? 'Email service is misconfigured (invalid Resend API key). Contact support.'
          : domainNotVerified
            ? 'Email domain is not verified with Resend. Contact support.'
            : 'Could not send email. Try again in a few minutes.',
        code: authFailed
          ? 'MAIL_AUTH_FAILED'
          : domainNotVerified
            ? 'MAIL_DOMAIN_NOT_VERIFIED'
            : 'MAIL_DELIVERY_FAILED',
      });
    }
  }

  private async sendViaResendHttp(
    from: string,
    to: string,
    subject: string,
    text: string,
    apiKey: string,
  ): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      const detail = body.message || body.name || `HTTP ${res.status}`;
      throw new Error(detail);
    }
  }
}
