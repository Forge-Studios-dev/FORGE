import { AuthService } from './auth.service';

describe('AuthService logout', () => {
  const refreshTokenRepository = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn().mockResolvedValue({ id: 'sid-1' }),
    find: jest.fn().mockResolvedValue([{ id: 'sid-1' }, { id: 'sid-2' }]),
  };

  const authUserCache = { bust: jest.fn().mockResolvedValue(undefined) };
  const authSessionCache = { markRevoked: jest.fn().mockResolvedValue(undefined) };

  const service = new AuthService(
    {} as never,
    refreshTokenRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { ingest: jest.fn() } as never,
    {
      assertNotLocked: jest.fn(),
      recordFailedLogin: jest.fn(),
      clearFailures: jest.fn(),
    } as never,
    { isEnabled: jest.fn(), issueOtp: jest.fn(), verifyOtp: jest.fn() } as never,
    authUserCache as never,
    authSessionCache as never,
    { transaction: jest.fn() } as never,
    { claimReferral: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    refreshTokenRepository.findOne.mockResolvedValue({ id: 'sid-1' });
    refreshTokenRepository.find.mockResolvedValue([{ id: 'sid-1' }, { id: 'sid-2' }]);
  });

  it('logoutCurrent revokes by token hash only', async () => {
    await service.logoutCurrent('user-1', 'raw-refresh-token');
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', revoked: false }),
      { revoked: true },
    );
    const where = refreshTokenRepository.update.mock.calls[0][0];
    expect(where.tokenHash).toBeDefined();
    expect(where.tokenHash).toHaveLength(64);
    expect(authSessionCache.markRevoked).toHaveBeenCalledWith('sid-1');
  });

  it('logoutAll revokes all user sessions', async () => {
    await service.logoutAll('user-1');
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', revoked: false },
      { revoked: true },
    );
    expect(authUserCache.bust).toHaveBeenCalledWith('user-1');
    expect(authSessionCache.markRevoked).toHaveBeenCalledTimes(2);
  });

  it('logoutCurrent without token falls back to logoutAll', async () => {
    await service.logoutCurrent('user-1', null);
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', revoked: false },
      { revoked: true },
    );
  });
});
