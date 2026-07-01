import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

const sendMailMock = jest.fn();
(nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });

function makeService(cfg: Record<string, unknown>): MailService {
  const configService = {
    get: jest.fn((key: string) => cfg[key]),
  } as unknown as ConfigService;
  return new MailService(configService);
}

function mockFetch(ok: boolean, body: Record<string, unknown> = {}, status = ok ? 200 : 422) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as typeof fetch;
}

describe('MailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });
  });

  describe('configuration detection', () => {
    it('is unconfigured when no SMTP/Resend credentials are present', () => {
      const service = makeService({ nodeEnv: 'development' });
      expect(service.isConfigured()).toBe(false);
    });

    it('detects Resend HTTP via an explicit API key', () => {
      const service = makeService({ 'mail.resendApiKey': 're_live_abc', nodeEnv: 'production' });
      expect(service.isConfigured()).toBe(true);
    });

    it('detects Resend HTTP when SMTP_PASS is a Resend key on the resend host', () => {
      const service = makeService({
        'mail.smtpHost': 'smtp.resend.com',
        'mail.smtpUser': 'resend',
        'mail.smtpPass': 're_live_xyz',
        nodeEnv: 'production',
      });
      expect(service.isConfigured()).toBe(true);
    });

    it('ignores placeholder Resend keys containing YOUR_', () => {
      const service = makeService({ 'mail.resendApiKey': 'YOUR_RESEND_KEY', nodeEnv: 'development' });
      expect(service.isConfigured()).toBe(false);
    });

    it('configures an SMTP transport for non-Resend providers', () => {
      const service = makeService({
        'mail.smtpHost': 'smtp.mailgun.org',
        'mail.smtpUser': 'user',
        'mail.smtpPass': 'secret',
        nodeEnv: 'production',
      });
      expect(service.isConfigured()).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.mailgun.org', auth: { user: 'user', pass: 'secret' } }),
      );
    });
  });

  describe('sendMail — unconfigured', () => {
    it('silently skips in development', async () => {
      const service = makeService({ nodeEnv: 'development' });
      await expect(service.sendMail('a@b.com', 'Hi', 'Body')).resolves.toBeUndefined();
    });

    it('throws MAIL_NOT_CONFIGURED in production', async () => {
      const service = makeService({ nodeEnv: 'production' });
      await expect(service.sendMail('a@b.com', 'Hi', 'Body')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('sendMail — Resend HTTP', () => {
    const cfg = {
      'mail.resendApiKey': 're_live_abc',
      'mail.from': 'noreply@forge.com',
      nodeEnv: 'production',
    };

    it('posts to the Resend API with bearer auth and recipient', async () => {
      mockFetch(true);
      const service = makeService(cfg);
      await service.sendMail('user@x.com', 'Welcome', 'Hello');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer re_live_abc' }),
        }),
      );
    });

    it('classifies invalid API key as MAIL_AUTH_FAILED', async () => {
      mockFetch(false, { message: 'Invalid API key' }, 401);
      const service = makeService(cfg);
      await expect(service.sendMail('user@x.com', 'S', 'B')).rejects.toMatchObject({
        response: { code: 'MAIL_AUTH_FAILED' },
      });
    });

    it('classifies unverified domain as MAIL_DOMAIN_NOT_VERIFIED', async () => {
      mockFetch(false, { message: 'The domain is not verified' });
      const service = makeService(cfg);
      await expect(service.sendMail('user@x.com', 'S', 'B')).rejects.toMatchObject({
        response: { code: 'MAIL_DOMAIN_NOT_VERIFIED' },
      });
    });

    it('falls back to MAIL_DELIVERY_FAILED for generic errors', async () => {
      mockFetch(false, { message: 'Service overloaded' }, 503);
      const service = makeService(cfg);
      await expect(service.sendMail('user@x.com', 'S', 'B')).rejects.toMatchObject({
        response: { code: 'MAIL_DELIVERY_FAILED' },
      });
    });
  });

  describe('sendMail — SMTP', () => {
    const cfg = {
      'mail.smtpHost': 'smtp.mailgun.org',
      'mail.smtpUser': 'user',
      'mail.smtpPass': 'secret',
      'mail.from': 'noreply@forge.com',
      nodeEnv: 'production',
    };

    it('delegates to the nodemailer transport', async () => {
      sendMailMock.mockResolvedValue({});
      const service = makeService(cfg);
      await service.sendMail('user@x.com', 'Subject', 'Body');
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@x.com', subject: 'Subject', from: 'noreply@forge.com' }),
      );
    });

    it('wraps transport authentication failures as MAIL_AUTH_FAILED', async () => {
      sendMailMock.mockRejectedValue(new Error('535 authentication failed'));
      const service = makeService(cfg);
      await expect(service.sendMail('user@x.com', 'S', 'B')).rejects.toMatchObject({
        response: { code: 'MAIL_AUTH_FAILED' },
      });
    });
  });
});
