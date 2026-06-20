import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessSessionsService } from './access-sessions.service';
import { AccessSessionAudit } from './entities/access-session-audit.entity';
import { AccessSessionType } from './dto/access-session.dto';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('AccessSessionsService', () => {
  let service: AccessSessionsService;
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    smembers: jest.Mock;
    sadd: jest.Mock;
    srem: jest.Mock;
    expire: jest.Mock;
  };
  let auditRepository: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let entitlementsService: { getMembershipForViewer: jest.Mock; getMaxConcurrentDevices: jest.Mock };

  beforeEach(async () => {
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    auditRepository = {
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn((x) => x),
      findOne: jest.fn().mockResolvedValue(null),
    };
    entitlementsService = {
      getMembershipForViewer: jest.fn().mockResolvedValue({ active: true }),
      getMaxConcurrentDevices: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessSessionsService,
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: getRepositoryToken(AccessSessionAudit), useValue: auditRepository },
        { provide: EntitlementsService, useValue: entitlementsService },
      ],
    }).compile();

    service = module.get(AccessSessionsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.smembers.mockResolvedValue([]);
    redis.setex.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    entitlementsService.getMaxConcurrentDevices.mockResolvedValue(1);
    auditRepository.findOne.mockResolvedValue(null);
  });

  it('starts a new session when none exists', async () => {
    const result = await service.startSession('user-1', {
      sessionType: AccessSessionType.PLAYBACK,
      resourceId: 'video-1',
    });

    expect(result.sessionToken).toBeDefined();
    expect(result.heartbeatIntervalSec).toBe(45);
    expect(result.maxDevices).toBe(1);
    expect(redis.setex).toHaveBeenCalled();
    expect(redis.sadd).toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalled();
  });

  it('throws concurrent_session when device limit is reached', async () => {
    entitlementsService.getMaxConcurrentDevices.mockResolvedValue(1);
    redis.smembers.mockResolvedValue(['existing-token']);
    redis.get.mockResolvedValue(
      JSON.stringify({ userId: 'user-1', sessionType: AccessSessionType.PLAYBACK, startedAt: new Date().toISOString() }),
    );

    await expect(
      service.startSession('user-1', { sessionType: AccessSessionType.PLAYBACK }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws device_limit when tier allows multiple devices but cap is reached', async () => {
    entitlementsService.getMaxConcurrentDevices.mockResolvedValue(3);
    redis.smembers.mockResolvedValue(['t1', 't2', 't3']);
    redis.get.mockImplementation(async (key: string) => {
      const token = String(key).split(':').pop();
      return JSON.stringify({
        userId: 'user-1',
        sessionType: AccessSessionType.PLAYBACK,
        startedAt: token === 't1' ? '2020-01-01' : token === 't2' ? '2020-01-02' : '2020-01-03',
      });
    });

    await expect(
      service.startSession('user-1', { sessionType: AccessSessionType.LIVE }),
    ).rejects.toMatchObject({ response: { code: 'device_limit' } });
  });

  it('replaces existing session when force=true', async () => {
    const existingPayload = JSON.stringify({
      userId: 'user-1',
      sessionType: AccessSessionType.PLAYBACK,
      startedAt: new Date().toISOString(),
    });
    redis.smembers.mockResolvedValue(['existing-token']);
    redis.get.mockResolvedValue(existingPayload);

    const result = await service.startSession('user-1', {
      sessionType: AccessSessionType.LIVE,
      force: true,
    });

    expect(result.sessionToken).toBeDefined();
    expect(redis.del).toHaveBeenCalled();
  });

  it('refreshes session on heartbeat', async () => {
    const payload = JSON.stringify({
      userId: 'user-1',
      sessionType: AccessSessionType.PLAYBACK,
      startedAt: new Date().toISOString(),
    });
    redis.get.mockResolvedValueOnce(payload);

    const result = await service.heartbeat('user-1', 'token-abc');
    expect(result.ok).toBe(true);
    expect(redis.setex).toHaveBeenCalled();
  });

  it('rejects heartbeat for mismatched user', async () => {
    redis.get.mockResolvedValueOnce(
      JSON.stringify({ userId: 'other-user', sessionType: AccessSessionType.PLAYBACK }),
    );

    await expect(service.heartbeat('user-1', 'token-abc')).rejects.toThrow(UnauthorizedException);
  });

  it('assertSessionAllowed throws when no session exists', async () => {
    await expect(
      service.assertSessionAllowed('user-1', AccessSessionType.PLAYBACK, 'video-1'),
    ).rejects.toThrow(ConflictException);
  });
});
