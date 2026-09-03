import { ForbiddenException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService.mockSubscribe production guard', () => {
  function makeService(opts: { mockEnabled: boolean; nodeEnv: string }) {
    const service = Object.create(EntitlementsService.prototype) as EntitlementsService;
    (service as unknown as { configService: { get: (k: string) => unknown } }).configService = {
      get: (key: string) => {
        if (key === 'entitlements.mockSubscriptionsEnabled') return opts.mockEnabled;
        if (key === 'nodeEnv') return opts.nodeEnv;
        return undefined;
      },
    };
    (service as unknown as { assertNotBlockedPeer: () => Promise<void> }).assertNotBlockedPeer =
      jest.fn().mockResolvedValue(undefined);
    (service as unknown as { grantSubscription: () => Promise<{ id: string }> }).grantSubscription =
      jest.fn().mockResolvedValue({ id: 'sub-1' });
    return service;
  }

  it('rejects when mock flag is off', async () => {
    const service = makeService({ mockEnabled: false, nodeEnv: 'development' });
    await expect(
      service.mockSubscribe('u1', { creatorId: 'c1', tierId: 't1' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects in production even if mock flag is somehow on', async () => {
    const service = makeService({ mockEnabled: true, nodeEnv: 'production' });
    await expect(
      service.mockSubscribe('u1', { creatorId: 'c1', tierId: 't1' } as never),
    ).rejects.toThrow(/production/i);
  });

  it('grants in non-prod when flag is on', async () => {
    const service = makeService({ mockEnabled: true, nodeEnv: 'development' });
    await expect(
      service.mockSubscribe('u1', { creatorId: 'c1', tierId: 't1' } as never),
    ).resolves.toEqual({ id: 'sub-1' });
  });
});
