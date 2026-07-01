import { StreamAnalyticsController } from './stream-analytics.controller';
import { StreamAnalyticsService } from './stream-analytics.service';
import { StreamLiveService } from './stream-live.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../users/entities/user.entity';

describe('StreamAnalyticsController', () => {
  const analyticsService = { getCreatorStreamAnalytics: jest.fn() };
  const liveService = { getStreamHealth: jest.fn() };
  const controller = new StreamAnalyticsController(
    analyticsService as unknown as StreamAnalyticsService,
    liveService as unknown as StreamLiveService,
  );

  const user = { sub: 'creator-1', role: UserRole.CREATOR } as unknown as JwtPayload;

  beforeEach(() => jest.clearAllMocks());

  it('passes the authenticated creator id and role to analytics', async () => {
    analyticsService.getCreatorStreamAnalytics.mockResolvedValue({ ok: true });
    await controller.getAnalytics(user, 'stream-9');
    expect(analyticsService.getCreatorStreamAnalytics).toHaveBeenCalledWith(
      'creator-1',
      'stream-9',
      'creator-1',
      UserRole.CREATOR,
    );
  });

  it('passes the authenticated creator id and role to health', async () => {
    liveService.getStreamHealth.mockResolvedValue({ healthy: true });
    await controller.getHealth(user, 'stream-9');
    expect(liveService.getStreamHealth).toHaveBeenCalledWith(
      'stream-9',
      'creator-1',
      UserRole.CREATOR,
    );
  });
});
