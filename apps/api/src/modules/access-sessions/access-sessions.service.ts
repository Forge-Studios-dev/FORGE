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

  private userSessionKey(userId: string): string {
    return `access:session:user:${userId}`;
  }

  private tokenKey(token: string): string {
    return `access:session:token:${token}`;
  }

  async startSession(
    userId: string,
    dto: StartAccessSessionDto,
    meta?: { deviceFingerprint?: string | null; userAgent?: string | null },
  ) {
    const existingToken = await this.redis.get(this.userSessionKey(userId));
    if (existingToken) {
      const existing = await this.redis.get(this.tokenKey(existingToken));
      if (existing && !dto.force) {
        throw new ConflictException({
          code: 'concurrent_session',
          message: 'Another active viewing session exists. End it or use force=true.',
        });
      }
      if (existing) {
        await this.endSession(userId, existingToken, 'replaced');
      }
    }

    const sessionToken = randomBytes(32).toString('hex');
    const payload: SessionPayload = {
      userId,
      sessionType: dto.sessionType,
      resourceId: dto.resourceId ?? null,
      deviceFingerprint: meta?.deviceFingerprint ?? null,
      startedAt: new Date().toISOString(),
    };

    await this.redis.setex(this.tokenKey(sessionToken), SESSION_TTL_SEC, JSON.stringify(payload));
    await this.redis.setex(this.userSessionKey(userId), SESSION_TTL_SEC, sessionToken);

    await this.auditRepository.save(
      this.auditRepository.create({
        userId,
        sessionType: dto.sessionType,
        resourceId: dto.resourceId ?? null,
        deviceFingerprint: meta?.deviceFingerprint ?? null,
      }),
    );

    return {
      sessionToken,
      heartbeatIntervalSec: HEARTBEAT_INTERVAL_SEC,
      expiresInSec: SESSION_TTL_SEC,
    };
  }

  async heartbeat(userId: string, sessionToken: string) {
    const raw = await this.redis.get(this.tokenKey(sessionToken));
    if (!raw) throw new UnauthorizedException('Session expired or invalid');

    const payload = JSON.parse(raw) as SessionPayload;
    if (payload.userId !== userId) throw new UnauthorizedException('Session mismatch');

    await this.redis.setex(this.tokenKey(sessionToken), SESSION_TTL_SEC, raw);
    await this.redis.setex(this.userSessionKey(userId), SESSION_TTL_SEC, sessionToken);
    return { ok: true, expiresInSec: SESSION_TTL_SEC };
  }

  async endSession(userId: string, sessionToken: string, reason = 'ended') {
    const raw = await this.redis.get(this.tokenKey(sessionToken));
    if (raw) {
      const payload = JSON.parse(raw) as SessionPayload;
      if (payload.userId === userId) {
        await this.redis.del(this.tokenKey(sessionToken));
        await this.redis.del(this.userSessionKey(userId));

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
    const token = await this.redis.get(this.userSessionKey(userId));
    if (!token) return { active: false };
    const raw = await this.redis.get(this.tokenKey(token));
    if (!raw) return { active: false };
    const payload = JSON.parse(raw) as SessionPayload;
    return { active: true, sessionType: payload.sessionType, resourceId: payload.resourceId };
  }

  /** Enforce concurrent session for premium playback/live/course/community. */
  async assertSessionAllowed(userId: string, sessionType: AccessSessionType, resourceId?: string) {
    const token = await this.redis.get(this.userSessionKey(userId));
    if (!token) {
      throw new ConflictException({
        code: 'session_required',
        message: 'Start an access session before viewing premium content',
      });
    }
    const raw = await this.redis.get(this.tokenKey(token));
    if (!raw) {
      throw new ConflictException({
        code: 'session_expired',
        message: 'Access session expired — refresh heartbeat',
      });
    }
    const payload = JSON.parse(raw) as SessionPayload;
    if (payload.sessionType !== sessionType) {
      throw new ConflictException({
        code: 'concurrent_session',
        message: 'Active session is for a different content type',
      });
    }
    if (resourceId && payload.resourceId && payload.resourceId !== resourceId) {
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
