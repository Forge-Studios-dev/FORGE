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
    set: jest.fn().mockResolvedValue('OK'),
  };
  const streamingService = {
    assertStreamSocketAccess: jest.fn(),
    findById: jest.fn(),
    invalidateStreamListCache: jest.fn().mockResolvedValue(undefined),
  };
  const muxLiveSyncService = {
    reconnectGraceSec: jest.fn().mockReturnValue(60),
  };
  const videosService = {
    getVideoForViewer: jest.fn(),
  };
  const streamReactionService = {
    react: jest.fn().mockResolvedValue({ reaction: 'heart', count: 1 }),
  };
  const communitiesService = {
    verifyChannelAccess: jest.fn(),
    assertCommunityAccess: jest.fn(),
  };
  const communityRoomsService = {
    assertRoomAccess: jest.fn(),
  };
  const directMessagesService = {
    assertMember: jest.fn(),
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
      muxLiveSyncService as never,
      streamReactionService as never,
      videosService as never,
      communitiesService as never,
      communityRoomsService as never,
      directMessagesService as never,
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

  it('tells a late joiner the host is mid-reconnect so the UI can show the overlay immediately', async () => {
    streamingService.assertStreamSocketAccess.mockResolvedValue(true);
    streamingService.findById.mockResolvedValue({ status: 'live', muxIdleSince: new Date() });
    const result = await gateway.handleJoinStream(
      { streamId: 'stream-1' },
      authedClient() as never,
    );
    expect(result.data.reconnecting).toBe(true);
  });

  it('reports reconnecting=false once the host is active again', async () => {
    streamingService.assertStreamSocketAccess.mockResolvedValue(true);
    streamingService.findById.mockResolvedValue({ status: 'live', muxIdleSince: null });
    const result = await gateway.handleJoinStream(
      { streamId: 'stream-1' },
      authedClient() as never,
    );
    expect(result.data.reconnecting).toBe(false);
  });

  it('relays stream.reconnecting to the stream room', () => {
    const emit = jest.fn();
    (gateway as unknown as { server: unknown }).server = { to: jest.fn().mockReturnValue({ emit }) };
    const payload = { streamId: 'stream-1', userId: 'creator-1', since: new Date().toISOString(), timeoutSec: 60, attempt: 1 };
    gateway.handleStreamReconnecting(payload);
    expect(emit).toHaveBeenCalledWith('stream:reconnecting', payload);
  });

  it('relays stream.reconnected to the stream room', () => {
    const emit = jest.fn();
    (gateway as unknown as { server: unknown }).server = { to: jest.fn().mockReturnValue({ emit }) };
    const payload = { streamId: 'stream-1', userId: 'creator-1' };
    gateway.handleStreamReconnected(payload);
    expect(emit).toHaveBeenCalledWith('stream:reconnected', payload);
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

  it('denies join-room when room access fails', async () => {
    communityRoomsService.assertRoomAccess.mockRejectedValue(new ForbiddenException());
    await expect(
      gateway.handleJoinRoom(
        { communityId: 'comm-1', roomId: 'room-1' },
        authedClient() as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows join-room when room access passes', async () => {
    communityRoomsService.assertRoomAccess.mockResolvedValue({ id: 'room-1' });
    const client = authedClient();
    const result = await gateway.handleJoinRoom(
      { communityId: 'comm-1', roomId: 'room-1' },
      client as never,
    );
    expect(client.join).toHaveBeenCalledWith('room:room-1');
    expect(result).toEqual({ event: 'joined-room', data: { roomId: 'room-1' } });
  });

  it('denies join-conversation when not a member', async () => {
    directMessagesService.assertMember.mockRejectedValue(new ForbiddenException());
    const client = authedClient();
    await expect(
      gateway.handleJoinConversation({ conversationId: 'conv-1' }, client as never),
    ).rejects.toThrow(WsException);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('allows join-conversation when a member', async () => {
    directMessagesService.assertMember.mockResolvedValue({ id: 'member-1' });
    const client = authedClient();
    const result = await gateway.handleJoinConversation(
      { conversationId: 'conv-1' },
      client as never,
    );
    expect(client.join).toHaveBeenCalledWith('conversation:conv-1');
    expect(result).toEqual({
      event: 'joined-conversation',
      data: { conversationId: 'conv-1', userId: 'user-1' },
    });
  });
});
