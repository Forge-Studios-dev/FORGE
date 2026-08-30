import {
  getSessionCreatorIds,
  pushSessionCreator,
  sessionCreatorsKey,
  SESSION_WATCH_MIN_PROGRESS_SEC,
} from './session-watch.util';

describe('session-watch.util', () => {
  const redis = {
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(() => {
    redis.get.mockReset();
    redis.setex.mockReset().mockResolvedValue('OK');
  });

  it('exports dwell threshold', () => {
    expect(SESSION_WATCH_MIN_PROGRESS_SEC).toBe(15);
  });

  it('getSessionCreatorIds returns [] when missing', async () => {
    redis.get.mockResolvedValue(null);
    await expect(getSessionCreatorIds(redis as never, 'u1')).resolves.toEqual([]);
  });

  it('pushSessionCreator prepends and refreshes TTL', async () => {
    redis.get.mockResolvedValue(JSON.stringify(['old-creator']));
    await pushSessionCreator(redis as never, 'u1', 'new-creator');
    expect(redis.setex).toHaveBeenCalledWith(
      sessionCreatorsKey('u1'),
      7200,
      JSON.stringify(['new-creator', 'old-creator']),
    );
  });

  it('pushSessionCreator skips self and empty', async () => {
    await pushSessionCreator(redis as never, 'u1', 'u1');
    await pushSessionCreator(redis as never, 'u1', '');
    expect(redis.setex).not.toHaveBeenCalled();
  });
});
