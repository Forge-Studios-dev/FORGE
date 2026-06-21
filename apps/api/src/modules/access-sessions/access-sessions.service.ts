import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { AccessSessionAudit } from './entities/access-session-audit.entity';
import { AccessSessionType, StartAccessSessionDto } from './dto/access-session.dto';
import { EntitlementsService } from '../entitlements/entitlements.service';

const SESSION_TTL_SEC = 120;
const HEARTBEAT_INTERVAL_SEC = 45;

type SessionPayload = {
  userId: string;
  sessionType: AccessSessionType;
  resourceId?: string | null;
  creatorId?: string | null;
  deviceFingerprint?: string | null;
  startedAt: string;
};

@Injectable()
export class AccessSessionsService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(AccessSessionAudit)
    private readonly auditRepository: Repository<AccessSessionAudit>,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  private legacyUserSessionKey(userId: string): string {
    return `access:session:user:${userId}`;
  }

  private userTokensKey(userId: string): string {
    return `access:session:user:${userId}:tokens`;
  }

  private tokenKey(token: string): string {
    return `access:session:token:${token}`;
  }

  private async migrateLegacySession(userId: string): Promise<void> {
    const legacy = await this.redis.get(this.legacyUserSessionKey(userId));
    if (!legacy) return;
    await this.redis.sadd(this.userTokensKey(userId), legacy);
    await this.redis.del(this.legacyUserSessionKey(userId));
  }

  private async getActiveSessionPayloads(
    userId: string,
    creatorId?: string | null,
  ): Promise<Array<{ token: string; payload: SessionPayload }>> {
    await this.migrateLegacySession(userId);
    const tokens = await this.redis.smembers(this.userTokensKey(userId));
    const results: Array<{ token: string; payload: SessionPayload }> = [];
    if (!tokens.length) return results;

    const pipeline = this.redis.pipeline();
    for (const token of tokens) {
      pipeline.get(this.tokenKey(token));
    }
    const rawResults = await pipeline.exec();

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const raw = rawResults?.[i]?.[1] as string | null;
      if (!raw) {
        await this.redis.srem(this.userTokensKey(userId), token);
        continue;
      }
      const payload = JSON.parse(raw) as SessionPayload;
      if (payload.userId !== userId) {
        await this.redis.srem(this.userTokensKey(userId), token);
        await this.redis.del(this.tokenKey(token));
        continue;
      }
      if (creatorId && payload.creatorId && payload.creatorId !== creatorId) {
        continue;
      }
      results.push({ token, payload });
    }
    return results;
  }

  async startSession(
    userId: string,
    dto: StartAccessSessionDto,
    meta?: { deviceFingerprint?: string | null; userAgent?: string | null },
  ) {
    const creatorId = dto.creatorId ?? null;
    const maxDevices = await this.entitlementsService.getMaxConcurrentDevices(
      userId,
      creatorId ?? undefined,
    );
    const active = await this.getActiveSessionPayloads(userId, creatorId);
    const deviceFingerprint = meta?.deviceFingerprint ?? null;

    const sameDeviceSession = deviceFingerprint
      ? active.find((s) => s.payload.deviceFingerprint === deviceFingerprint)
      : undefined;

    if (sameDeviceSession) {
      await this.endSession(userId, sameDeviceSession.token, 'replaced');
    } else if (active.length >= maxDevices) {
      if (!dto.force) {
        throw new ConflictException({
          code: maxDevices > 1 ? 'device_limit' : 'concurrent_session',
          message:
            maxDevices > 1
              ? `Device limit reached (${maxDevices}). End another session or use force=true.`
              : 'Another active viewing session exists. End it or use force=true.',
          maxDevices,
        });
      }
      const oldest = [...active].sort((a, b) =>
        a.payload.startedAt.localeCompare(b.payload.startedAt),
      )[0];
      if (oldest) {
        await this.endSession(userId, oldest.token, 'replaced');
      }
    }

    const sessionToken = randomBytes(32).toString('hex');
    const payload: SessionPayload = {
      userId,
      sessionType: dto.sessionType,
      resourceId: dto.resourceId ?? null,
      creatorId,
      deviceFingerprint,
      startedAt: new Date().toISOString(),
    };

    await this.redis.setex(this.tokenKey(sessionToken), SESSION_TTL_SEC, JSON.stringify(payload));
    await this.redis.sadd(this.userTokensKey(userId), sessionToken);
    await this.redis.expire(this.userTokensKey(userId), SESSION_TTL_SEC * 2);

    await this.auditRepository.save(
      this.auditRepository.create({
        userId,
        sessionType: dto.sessionType,
        resourceId: dto.resourceId ?? null,
        deviceFingerprint,
      }),
    );

    return {
      sessionToken,
      heartbeatIntervalSec: HEARTBEAT_INTERVAL_SEC,
      expiresInSec: SESSION_TTL_SEC,
      maxDevices,
    };
  }

  async heartbeat(userId: string, sessionToken: string) {
    const raw = await this.redis.get(this.tokenKey(sessionToken));
    if (!raw) throw new UnauthorizedException('Session expired or invalid');

    const payload = JSON.parse(raw) as SessionPayload;
    if (payload.userId !== userId) throw new UnauthorizedException('Session mismatch');

    await this.redis.setex(this.tokenKey(sessionToken), SESSION_TTL_SEC, raw);
    await this.redis.sadd(this.userTokensKey(userId), sessionToken);
    await this.redis.expire(this.userTokensKey(userId), SESSION_TTL_SEC * 2);
    return { ok: true, expiresInSec: SESSION_TTL_SEC };
  }

  async endSession(userId: string, sessionToken: string, reason = 'ended') {
    const raw = await this.redis.get(this.tokenKey(sessionToken));
    if (raw) {
      const payload = JSON.parse(raw) as SessionPayload;
      if (payload.userId === userId) {
        await this.redis.del(this.tokenKey(sessionToken));
        await this.redis.srem(this.userTokensKey(userId), sessionToken);

        const audit = await this.auditRepository.findOne({
          where: { userId, sessionType: payload.sessionType, endedAt: null as unknown as Date },
          order: { startedAt: 'DESC' },
        });
        if (audit) {
          audit.endedAt = new Date();
          audit.endedReason = reason;
          await this.auditRepository.save(audit);
        }
      }
    }
    return { ended: true };
  }

  async getCurrentSession(userId: string) {
    const active = await this.getActiveSessionPayloads(userId);
    if (!active.length) return { active: false as const };
    const primary = active[0].payload;
    const maxDevices = await this.entitlementsService.getMaxConcurrentDevices(userId);
    return {
      active: true as const,
      sessionType: primary.sessionType,
      resourceId: primary.resourceId,
      activeDeviceCount: active.length,
      maxDevices,
    };
  }

  /** Enforce concurrent session for premium playback/live/course/community. */
  async assertSessionAllowed(userId: string, sessionType: AccessSessionType, resourceId?: string) {
    const active = await this.getActiveSessionPayloads(userId);
    if (!active.length) {
      throw new ConflictException({
        code: 'session_required',
        message: 'Start an access session before viewing premium content',
      });
    }
    const match = active.find(
      (s) =>
        s.payload.sessionType === sessionType &&
        (!resourceId || !s.payload.resourceId || s.payload.resourceId === resourceId),
    );
    if (!match) {
      throw new ConflictException({
        code: 'concurrent_session',
        message: 'Active session is for different content',
      });
    }
  }

  async requirePremiumSession(
    userId: string | null | undefined,
    creatorId: string,
    sessionType: AccessSessionType,
    resourceId?: string,
  ): Promise<void> {
    if (!userId) return;
    const membership = await this.entitlementsService.getMembershipForViewer(userId, creatorId);
    if (!membership.active) return;
    await this.assertSessionAllowed(userId, sessionType, resourceId);
  }
}
