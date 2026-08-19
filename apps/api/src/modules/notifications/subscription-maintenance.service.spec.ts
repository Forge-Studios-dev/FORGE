import { SubscriptionMaintenanceService } from './subscription-maintenance.service';
import { NotificationType } from './entities/notification.entity';
import { MemberSubscriptionStatus } from '../entitlements/entities/member-subscription.entity';

describe('SubscriptionMaintenanceService', () => {
  let service: SubscriptionMaintenanceService;
  let entitlements: {
    getExpiringSubscriptions: jest.Mock;
    expireDueSubscriptions: jest.Mock;
  };
  let notifications: { createMany: jest.Mock };
  let pushDispatch: { enqueueMany: jest.Mock };
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    mget: jest.Mock;
    pipeline: jest.Mock;
  };
  let pipelineExec: jest.Mock;

  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    entitlements = {
      getExpiringSubscriptions: jest.fn().mockResolvedValue([]),
      expireDueSubscriptions: jest.fn().mockResolvedValue(0),
    };
    notifications = { createMany: jest.fn().mockResolvedValue(undefined) };
    pushDispatch = { enqueueMany: jest.fn().mockResolvedValue(undefined) };
    pipelineExec = jest.fn().mockResolvedValue([]);
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      mget: jest.fn().mockResolvedValue([]),
      pipeline: jest.fn(() => ({ setex: jest.fn().mockReturnThis(), exec: pipelineExec })),
    };

    service = new SubscriptionMaintenanceService(
      entitlements as never,
      notifications as never,
      pushDispatch as never,
      redis as never,
    );
  });

  it('sends trial-ending copy for trials and expiry copy for active subs', async () => {
    entitlements.getExpiringSubscriptions.mockResolvedValue([
      {
        id: 'sub-trial',
        userId: 'user-trial',
        creatorId: 'creator-1',
        tierId: 'tier-1',
        status: MemberSubscriptionStatus.TRIAL,
        expiresAt: inDays(2),
        tier: { name: 'Gold' },
      },
      {
        id: 'sub-active',
        userId: 'user-active',
        creatorId: 'creator-1',
        tierId: 'tier-1',
        status: MemberSubscriptionStatus.ACTIVE,
        expiresAt: inDays(2),
        tier: { name: 'Gold' },
      },
    ]);
    redis.mget.mockResolvedValue([null, null]);

    await service.runMaintenance();

    expect(notifications.createMany).toHaveBeenCalledTimes(1);
    const created = notifications.createMany.mock.calls[0][0];
    const trial = created.find((n: { userId: string }) => n.userId === 'user-trial');
    const active = created.find((n: { userId: string }) => n.userId === 'user-active');

    expect(trial.type).toBe(NotificationType.SUBSCRIPTION_EXPIRING);
    expect(trial.title).toContain('trial ending soon');
    expect(trial.body).toContain('free trial ends');
    expect(trial.metadata.isTrial).toBe(true);

    expect(active.title).toContain('expiring soon');
    expect(active.body).toContain('membership expires');
    expect(active.metadata.isTrial).toBe(false);

    const pushed = pushDispatch.enqueueMany.mock.calls[0][0];
    const trialPush = pushed.find((p: { userId: string }) => p.userId === 'user-trial');
    const activePush = pushed.find((p: { userId: string }) => p.userId === 'user-active');
    expect(trialPush.data.type).toBe('trial_ending');
    expect(activePush.data.type).toBe('subscription_expiring');

    expect(entitlements.expireDueSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('skips members already notified (dedupe)', async () => {
    entitlements.getExpiringSubscriptions.mockResolvedValue([
      {
        id: 'sub-1',
        userId: 'user-1',
        creatorId: 'creator-1',
        tierId: 'tier-1',
        status: MemberSubscriptionStatus.TRIAL,
        expiresAt: inDays(1),
        tier: { name: 'Gold' },
      },
    ]);
    redis.mget.mockResolvedValue(['1']);

    await service.runMaintenance();

    expect(notifications.createMany).not.toHaveBeenCalled();
    expect(entitlements.expireDueSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('does not mark the dedupe key when sending fails, so the next run retries instead of silently dropping the alert', async () => {
    entitlements.getExpiringSubscriptions.mockResolvedValue([
      {
        id: 'sub-1',
        userId: 'user-1',
        creatorId: 'creator-1',
        tierId: 'tier-1',
        status: MemberSubscriptionStatus.TRIAL,
        expiresAt: inDays(1),
        tier: { name: 'Gold' },
      },
    ]);
    redis.mget.mockResolvedValue([null]);
    notifications.createMany.mockRejectedValue(new Error('db down'));

    await service.runMaintenance();

    expect(pipelineExec).not.toHaveBeenCalled();
  });
});
