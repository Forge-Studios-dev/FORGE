import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { EventsGateway } from './events.gateway';
import { UserRole } from '../modules/users/entities/user.entity';

describe('EventsGateway room authorization', () => {
  const configService = {
    get: jest.fn((key: string) => (key === 'jwt.secret' ? 'test-secret' : undefined)),
  };
  const jwtService = {
    verify: jest.fn(),
  };
  const streamViewerService = {
    join: jest.fn().mockResolvedValue(1),
    leave: jest.fn(),
  };
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
  };
  const streamingService = {
    assertStreamSocketAccess: jest.fn(),
  };
  const videosService = {
    getVideoForViewer: jest.fn(),
  };
  const streamReactionService = {
    react: jest.fn().mockResolvedValue({ reaction: 'heart', count: 1 }),
  };
  const communitiesService = {
    verifyChannelAccess: jest.fn(),
  };

  let gateway: EventsGateway;

  const authedClient = () => {
    const client = {
      id: 'socket-1',
      data: { userId: 'user-1', role: UserRole.USER },
      join: jest.fn(),
      leave: jest.fn(),
    };
    return client;
  };

  const guestClient = () => ({
    id: 'socket-2',
    data: {},
    join: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new EventsGateway(
      redis as never,
      configService as unknown as ConfigService,
      jwtService as unknown as JwtService,
      streamViewerService as never,
      streamingService as never,
      streamReactionService as never,
      videosService as never,
      communitiesService as never,
    );
    (gateway as unknown as { server: unknown }).server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
  });

  it('requires auth for join-live-feed', () => {
    expect(() => gateway.handleJoinLiveFeed(guestClient() as never)).toThrow(WsException);
  });

  it('allows authenticated join-live-feed', () => {
    const client = authedClient();
    const result = gateway.handleJoinLiveFeed(client as never);
    expect(client.join).toHaveBeenCalledWith('streams:live');
    expect(result).toEqual({ event: 'joined-live-feed', data: { ok: true } });
  });

  it('denies join-stream when accessDenied', async () => {
    streamingService.assertStreamSocketAccess.mockResolvedValue(false);
    await expect(
      gateway.handleJoinStream({ streamId: 'stream-1' }, authedClient() as never),
    ).rejects.toThrow(WsException);
  });

  it('denies join-video when forbidden', async () => {
    videosService.getVideoForViewer.mockRejectedValue(new ForbiddenException());
    await expect(
      gateway.handleJoinVideo({ videoId: 'video-1' }, authedClient() as never),
    ).rejects.toThrow(WsException);
  });

  it('denies join-channel when forbidden', async () => {
    communitiesService.verifyChannelAccess.mockRejectedValue(new ForbiddenException());
    await expect(
      gateway.handleJoinChannel({ channelId: 'channel-1' }, authedClient() as never),
    ).rejects.toThrow(WsException);
  });
});
