import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import {
  FraudAlert,
  FraudAlertStatus,
  FraudSignal,
} from './entities/fraud-alert.entity';

export interface RuleResult {
  triggered: boolean;
  riskScore: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  // Risk thresholds
  private static readonly VELOCITY_WINDOW_MINUTES = 10;
  private static readonly VELOCITY_MAX_SUBS = 3;
  private static readonly RAPID_CANCEL_DAYS = 3;
  private static readonly RAPID_CANCEL_MAX = 2;
  private static readonly NEW_ACCOUNT_DAYS = 7;
  private static readonly NEW_ACCOUNT_SPEND_CENTS = 5000; // $50

  constructor(
    @InjectRepository(FraudAlert)
    private readonly alertRepository: Repository<FraudAlert>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Rule evaluators ────────────────────────────────────────────────────────

  private async checkVelocityPayment(userId: string): Promise<RuleResult> {
    const [{ count }] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) as count FROM member_subscriptions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${FraudDetectionService.VELOCITY_WINDOW_MINUTES} minutes'`,
      [userId],
    );
    const num = parseInt(count, 10);
    return {
      triggered: num >= FraudDetectionService.VELOCITY_MAX_SUBS,
      riskScore: Math.min(40 + num * 15, 95),
      metadata: {
        subscriptionsInWindow: num,
        windowMinutes: FraudDetectionService.VELOCITY_WINDOW_MINUTES,
      },
    };
  }

  private async checkRapidSubscribeCancel(userId: string): Promise<RuleResult> {
    const [{ count }] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) as count FROM member_subscriptions
       WHERE user_id = $1
         AND status IN ('cancelled', 'expired')
         AND updated_at > NOW() - INTERVAL '${FraudDetectionService.RAPID_CANCEL_DAYS} days'
         AND updated_at - created_at < INTERVAL '24 hours'`,
      [userId],
    );
    const num = parseInt(count, 10);
    return {
      triggered: num >= FraudDetectionService.RAPID_CANCEL_MAX,
      riskScore: Math.min(50 + num * 20, 90),
      metadata: {
        rapidCancels: num,
        windowDays: FraudDetectionService.RAPID_CANCEL_DAYS,
      },
    };
  }

  private async checkNewAccountHighSpend(userId: string, amountCents?: number): Promise<RuleResult> {
    const [{ age_days, total_spend }] = await this.dataSource.query<
      [{ age_days: string; total_spend: string }]
    >(
      `SELECT
         EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS age_days,
         COALESCE((
           SELECT SUM(amount_cents) FROM stream_event_purchases WHERE user_id = $1
         ), 0) AS total_spend
       FROM users WHERE id = $1`,
      [userId],
    );

    const ageDays = parseFloat(age_days ?? '999');
    const spend = parseInt(total_spend, 10) + (amountCents ?? 0);
    const isNew = ageDays < FraudDetectionService.NEW_ACCOUNT_DAYS;
    const highSpend = spend >= FraudDetectionService.NEW_ACCOUNT_SPEND_CENTS;

    return {
      triggered: isNew && highSpend,
      riskScore: 65,
      metadata: { accountAgeDays: Math.round(ageDays), totalSpendCents: spend },
    };
  }

  private checkChargeback(): RuleResult {
    return { triggered: true, riskScore: 90, metadata: { type: 'chargeback' } };
  }

  // ── Core alert creation ────────────────────────────────────────────────────

  private async createAlert(
    userId: string,
    signal: FraudSignal,
    riskScore: number,
    metadata: Record<string, unknown>,
  ): Promise<FraudAlert> {
    const alert = await this.alertRepository.save(
      this.alertRepository.create({ userId, signal, riskScore, metadata }),
    );
    this.logger.warn(`Fraud alert: ${signal} userId=${userId} score=${riskScore}`);
    return alert;
  }

  private async runAndAlert(
    userId: string,
    signal: FraudSignal,
    check: () => Promise<RuleResult>,
  ): Promise<void> {
    try {
      const result = await check();
      if (result.triggered) {
        await this.createAlert(userId, signal, result.riskScore, result.metadata);
      }
    } catch (err) {
      this.logger.error(`Fraud check ${signal} failed: ${(err as Error).message}`);
    }
  }

  // ── Event listeners ────────────────────────────────────────────────────────

  @OnEvent('billing.subscription.created')
  async onSubscriptionCreated(payload: { userId: string }) {
    const { userId } = payload;
    await Promise.all([
      this.runAndAlert(userId, FraudSignal.VELOCITY_PAYMENT, () => this.checkVelocityPayment(userId)),
      this.runAndAlert(userId, FraudSignal.NEW_ACCOUNT_HIGH_SPEND, () =>
        this.checkNewAccountHighSpend(userId),
      ),
    ]);
  }

  @OnEvent('billing.subscription.cancelled')
  async onSubscriptionCancelled(payload: { userId: string }) {
    await this.runAndAlert(payload.userId, FraudSignal.RAPID_SUBSCRIBE_CANCEL, () =>
      this.checkRapidSubscribeCancel(payload.userId),
    );
  }

  @OnEvent('billing.chargeback')
  async onChargeback(payload: { userId: string; metadata?: Record<string, unknown> }) {
    const result = this.checkChargeback();
    await this.createAlert(payload.userId, FraudSignal.CHARGEBACK, result.riskScore, {
      ...result.metadata,
      ...(payload.metadata ?? {}),
    });
  }

  @OnEvent('billing.event_purchase.completed')
  async onEventPurchase(payload: { userId: string; amountCents: number }) {
    await this.runAndAlert(payload.userId, FraudSignal.NEW_ACCOUNT_HIGH_SPEND, () =>
      this.checkNewAccountHighSpend(payload.userId, payload.amountCents),
    );
  }

  // ── Admin queries ──────────────────────────────────────────────────────────

  async listAlerts(options: {
    status?: FraudAlertStatus;
    signal?: FraudSignal;
    limit?: number;
    offset?: number;
  }) {
    const qb = this.alertRepository.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (options.status) qb.andWhere('a.status = :status', { status: options.status });
    if (options.signal) qb.andWhere('a.signal = :signal', { signal: options.signal });
    const take = Math.min(options.limit ?? 50, 100);
    const skip = options.offset ?? 0;
    const [data, total] = await qb.take(take).skip(skip).getManyAndCount();
    return { data, total, limit: take, offset: skip };
  }

  async getUserRiskProfile(userId: string) {
    const alerts = await this.alertRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const openAlerts = alerts.filter((a) => a.status === FraudAlertStatus.OPEN);
    const maxScore = openAlerts.reduce((m, a) => Math.max(m, a.riskScore), 0);
    const riskLevel =
      maxScore >= 80 ? 'high' : maxScore >= 50 ? 'medium' : openAlerts.length ? 'low' : 'clean';
    return { userId, riskLevel, maxRiskScore: maxScore, openAlerts: openAlerts.length, alerts };
  }

  async updateAlertStatus(alertId: string, status: FraudAlertStatus, notes?: string): Promise<void> {
    await this.alertRepository.update(alertId, { status, notes: notes ?? null });
  }

  async runManualCheck(userId: string): Promise<{ signals: Array<{ signal: FraudSignal; result: RuleResult }> }> {
    const results = await Promise.all([
      this.checkVelocityPayment(userId).then((r) => ({ signal: FraudSignal.VELOCITY_PAYMENT, result: r })),
      this.checkRapidSubscribeCancel(userId).then((r) => ({ signal: FraudSignal.RAPID_SUBSCRIBE_CANCEL, result: r })),
      this.checkNewAccountHighSpend(userId).then((r) => ({ signal: FraudSignal.NEW_ACCOUNT_HIGH_SPEND, result: r })),
    ]);
    return { signals: results };
  }
}
