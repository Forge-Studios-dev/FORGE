import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudAlert, FraudAlertStatus, FraudSignal } from './entities/fraud-alert.entity';

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  const alertRepository = {
    save: jest.fn(async (a: unknown) => ({ id: 'alert-1', ...(a as object) })),
    create: jest.fn((a: unknown) => a),
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const dataSource = { query: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    alertRepository.create.mockImplementation((a: unknown) => a);
    alertRepository.save.mockImplementation(async (a: unknown) => ({ id: 'alert-1', ...(a as object) }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        { provide: getRepositoryToken(FraudAlert), useValue: alertRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(FraudDetectionService);
  });

  describe('runManualCheck — rule evaluation', () => {
    it('triggers velocity_payment when 3+ subscriptions were created within the window', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '3' }]) // velocity
        .mockResolvedValueOnce([{ count: '0' }]) // rapid cancel
        .mockResolvedValueOnce([{ age_days: '999', total_spend: '0' }]); // new-account spend

      const { signals } = await service.runManualCheck('user-1');
      const velocity = signals.find((s) => s.signal === FraudSignal.VELOCITY_PAYMENT)!;
      expect(velocity.result.triggered).toBe(true);
      expect(velocity.result.riskScore).toBe(85); // 40 + 3*15
      expect(velocity.result.metadata).toEqual({ subscriptionsInWindow: 3, windowMinutes: 10 });
    });

    it('does not trigger velocity_payment below the threshold', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ age_days: '999', total_spend: '0' }]);

      const { signals } = await service.runManualCheck('user-1');
      const velocity = signals.find((s) => s.signal === FraudSignal.VELOCITY_PAYMENT)!;
      expect(velocity.result.triggered).toBe(false);
    });

    it('triggers rapid_subscribe_cancel at 2+ same-day cancellations within the window', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{ age_days: '999', total_spend: '0' }]);

      const { signals } = await service.runManualCheck('user-1');
      const rapidCancel = signals.find((s) => s.signal === FraudSignal.RAPID_SUBSCRIBE_CANCEL)!;
      expect(rapidCancel.result.triggered).toBe(true);
      expect(rapidCancel.result.riskScore).toBe(90); // 50 + 2*20
    });

    it('triggers new_account_high_spend only when the account is both new AND over the spend threshold', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ age_days: '2', total_spend: '5000' }]);

      const { signals } = await service.runManualCheck('user-1');
      const spend = signals.find((s) => s.signal === FraudSignal.NEW_ACCOUNT_HIGH_SPEND)!;
      expect(spend.result.triggered).toBe(true);
      expect(spend.result.metadata).toEqual({ accountAgeDays: 2, totalSpendCents: 5000 });
    });

    it('does not trigger new_account_high_spend for an old account with high spend', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ age_days: '365', total_spend: '50000' }]);

      const { signals } = await service.runManualCheck('user-1');
      const spend = signals.find((s) => s.signal === FraudSignal.NEW_ACCOUNT_HIGH_SPEND)!;
      expect(spend.result.triggered).toBe(false);
    });

    it('does not trigger new_account_high_spend for a new account under the spend threshold', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ age_days: '1', total_spend: '100' }]);

      const { signals } = await service.runManualCheck('user-1');
      const spend = signals.find((s) => s.signal === FraudSignal.NEW_ACCOUNT_HIGH_SPEND)!;
      expect(spend.result.triggered).toBe(false);
    });
  });

  describe('event listeners create alerts only when a rule triggers', () => {
    it('onSubscriptionCreated creates an alert when velocity rule fires', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '5' }]) // velocity — triggers
        .mockResolvedValueOnce([{ age_days: '999', total_spend: '0' }]); // new-account — does not

      await service.onSubscriptionCreated({ userId: 'user-1' });

      expect(alertRepository.save).toHaveBeenCalledTimes(1);
      expect(alertRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', signal: FraudSignal.VELOCITY_PAYMENT }),
      );
    });

    it('onSubscriptionCreated creates no alert when neither rule fires', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ age_days: '999', total_spend: '0' }]);

      await service.onSubscriptionCreated({ userId: 'user-1' });

      expect(alertRepository.save).not.toHaveBeenCalled();
    });

    it('onSubscriptionCancelled creates an alert when rapid-cancel rule fires', async () => {
      dataSource.query.mockResolvedValueOnce([{ count: '3' }]);

      await service.onSubscriptionCancelled({ userId: 'user-1' });

      expect(alertRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ signal: FraudSignal.RAPID_SUBSCRIBE_CANCEL }),
      );
    });

    it('onChargeback always creates a high-risk alert, merging caller metadata', async () => {
      await service.onChargeback({ userId: 'user-1', metadata: { disputeId: 'dp_1' } });

      expect(alertRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          signal: FraudSignal.CHARGEBACK,
          riskScore: 90,
          metadata: expect.objectContaining({ type: 'chargeback', disputeId: 'dp_1' }),
        }),
      );
    });

    it('onEventPurchase runs the new-account-spend check with the purchase amount included', async () => {
      dataSource.query.mockResolvedValueOnce([{ age_days: '1', total_spend: '0' }]);

      await service.onEventPurchase({ userId: 'user-1', amountCents: 6000 });

      expect(alertRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: FraudSignal.NEW_ACCOUNT_HIGH_SPEND,
          metadata: expect.objectContaining({ totalSpendCents: 6000 }),
        }),
      );
    });

    it('swallows a rule-evaluation error without throwing (event handlers must not crash the emitter)', async () => {
      dataSource.query.mockRejectedValueOnce(new Error('db down'));

      await expect(service.onSubscriptionCancelled({ userId: 'user-1' })).resolves.toBeUndefined();
      expect(alertRepository.save).not.toHaveBeenCalled();
    });

    it('onSuspiciousLogin persists the risk/signal computed by AuthService verbatim', async () => {
      await service.onSuspiciousLogin({
        userId: 'user-1',
        signal: FraudSignal.RAPID_IP_CHANGE,
        riskScore: 55,
        metadata: { method: 'email', minutesSinceLastLogin: 2 },
      });

      expect(alertRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          signal: FraudSignal.RAPID_IP_CHANGE,
          riskScore: 55,
          metadata: { method: 'email', minutesSinceLastLogin: 2 },
        }),
      );
    });
  });

  describe('admin queries', () => {
    it('getUserRiskProfile computes risk level from open alerts only', async () => {
      alertRepository.find.mockResolvedValue([
        { status: FraudAlertStatus.OPEN, riskScore: 85 },
        { status: FraudAlertStatus.RESOLVED, riskScore: 95 },
        { status: FraudAlertStatus.OPEN, riskScore: 40 },
      ]);

      const profile = await service.getUserRiskProfile('user-1');
      expect(profile.riskLevel).toBe('high');
      expect(profile.maxRiskScore).toBe(85);
      expect(profile.openAlerts).toBe(2);
    });

    it('getUserRiskProfile reports clean when there are no alerts', async () => {
      alertRepository.find.mockResolvedValue([]);
      const profile = await service.getUserRiskProfile('user-1');
      expect(profile.riskLevel).toBe('clean');
    });

    it('updateAlertStatus persists status and notes', async () => {
      await service.updateAlertStatus('alert-1', FraudAlertStatus.RESOLVED, 'reviewed, ok');
      expect(alertRepository.update).toHaveBeenCalledWith('alert-1', {
        status: FraudAlertStatus.RESOLVED,
        notes: 'reviewed, ok',
      });
    });
  });
});
