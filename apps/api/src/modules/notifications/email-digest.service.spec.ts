import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EmailDigestService } from './email-digest.service';
import { User } from '../users/entities/user.entity';
import { Notification, NotificationType } from './entities/notification.entity';
import { MailService } from '../mail/mail.service';

function makeUserQb(...pages: User[][]) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  for (const page of pages) qb.getMany.mockResolvedValueOnce(page);
  qb.getMany.mockResolvedValue([]);
  return qb;
}

function makeNotificationQb(notifications: Notification[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(notifications),
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    lastEmailDigestSentAt: null,
    ...overrides,
  } as User;
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    userId: 'u1',
    type: NotificationType.NEW_FOLLOWER,
    title: 'Someone followed you',
    body: null,
    readAt: null,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  } as Notification;
}

describe('EmailDigestService', () => {
  let service: EmailDigestService;
  const userRepository = {
    createQueryBuilder: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const notificationRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mailService = {
    isConfigured: jest.fn().mockReturnValue(true),
    sendMail: jest.fn().mockResolvedValue(undefined),
  };
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mailService.isConfigured.mockReturnValue(true);
    mailService.sendMail.mockResolvedValue(undefined);
    userRepository.update.mockResolvedValue(undefined);
    configService.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailDigestService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Notification), useValue: notificationRepository },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(EmailDigestService);
  });

  it('sends nothing when there are no digest-opted-in users', async () => {
    userRepository.createQueryBuilder.mockReturnValue(makeUserQb([]));

    const result = await service.runDigest();

    expect(result).toEqual({ sent: 0, skipped: 0 });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('skips a user with no unread notifications since their last digest', async () => {
    userRepository.createQueryBuilder.mockReturnValue(makeUserQb([makeUser()]));
    notificationRepository.createQueryBuilder.mockReturnValue(makeNotificationQb([]));

    const result = await service.runDigest();

    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('sends a digest email and stamps lastEmailDigestSentAt', async () => {
    userRepository.createQueryBuilder.mockReturnValue(makeUserQb([makeUser({ id: 'u1', email: 'a@b.com' })]));
    notificationRepository.createQueryBuilder.mockReturnValue(
      makeNotificationQb([
        makeNotification({ title: 'Alice followed you' }),
        makeNotification({ title: 'New comment', body: 'Nice video!' }),
      ]),
    );

    const result = await service.runDigest();

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(mailService.sendMail).toHaveBeenCalledWith(
      'a@b.com',
      'Your FORGE digest: 2 new notifications',
      expect.stringContaining('- Alice followed you'),
    );
    expect(mailService.sendMail).toHaveBeenCalledWith(
      'a@b.com',
      expect.any(String),
      expect.stringContaining('- New comment: Nice video!'),
    );
    expect(userRepository.update).toHaveBeenCalledWith('u1', {
      lastEmailDigestSentAt: expect.any(Date),
    });
  });

  it('uses a 24h lookback window when the user has never been sent a digest', async () => {
    userRepository.createQueryBuilder.mockReturnValue(
      makeUserQb([makeUser({ lastEmailDigestSentAt: null })]),
    );
    const notificationQb = makeNotificationQb([makeNotification()]);
    notificationRepository.createQueryBuilder.mockReturnValue(notificationQb);

    const before = Date.now();
    await service.runDigest();

    const sinceArg = notificationQb.andWhere.mock.calls.find(
      ([clause]: [string]) => clause.includes('created_at'),
    )?.[1]?.since as Date;
    expect(sinceArg).toBeInstanceOf(Date);
    expect(before - sinceArg.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
  });

  it("uses the user's last digest timestamp as the lookback bound when present", async () => {
    const lastSent = new Date('2026-01-01T00:00:00Z');
    userRepository.createQueryBuilder.mockReturnValue(
      makeUserQb([makeUser({ lastEmailDigestSentAt: lastSent })]),
    );
    const notificationQb = makeNotificationQb([makeNotification()]);
    notificationRepository.createQueryBuilder.mockReturnValue(notificationQb);

    await service.runDigest();

    const sinceArg = notificationQb.andWhere.mock.calls.find(
      ([clause]: [string]) => clause.includes('created_at'),
    )?.[1]?.since;
    expect(sinceArg).toEqual(lastSent);
  });

  it('does not send or stamp when the mail service is not configured', async () => {
    mailService.isConfigured.mockReturnValue(false);
    userRepository.createQueryBuilder.mockReturnValue(makeUserQb([makeUser()]));
    notificationRepository.createQueryBuilder.mockReturnValue(
      makeNotificationQb([makeNotification()]),
    );

    const result = await service.runDigest();

    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('keeps processing other users when one send fails', async () => {
    userRepository.createQueryBuilder.mockReturnValue(
      makeUserQb([makeUser({ id: 'u1', email: 'fail@b.com' }), makeUser({ id: 'u2', email: 'ok@b.com' })]),
    );
    notificationRepository.createQueryBuilder
      .mockReturnValueOnce(makeNotificationQb([makeNotification({ userId: 'u1' })]))
      .mockReturnValueOnce(makeNotificationQb([makeNotification({ userId: 'u2' })]));
    mailService.sendMail
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined);

    const result = await service.runDigest();

    expect(result).toEqual({ sent: 1, skipped: 1 });
    expect(userRepository.update).toHaveBeenCalledTimes(1);
    expect(userRepository.update).toHaveBeenCalledWith('u2', { lastEmailDigestSentAt: expect.any(Date) });
  });
});
