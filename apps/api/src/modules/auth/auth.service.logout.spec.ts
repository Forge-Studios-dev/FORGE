import { AuthService } from './auth.service';

describe('AuthService logout', () => {
  const refreshTokenRepository = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const service = new AuthService(
    {} as never,
    refreshTokenRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { ingest: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  it('logoutAll revokes all user sessions', async () => {
    await service.logoutAll('user-1');
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', revoked: false },
      { revoked: true },
    );
  });

  it('logoutCurrent without token falls back to logoutAll', async () => {
    await service.logoutCurrent('user-1', null);
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', revoked: false },
      { revoked: true },
    );
  });
});
