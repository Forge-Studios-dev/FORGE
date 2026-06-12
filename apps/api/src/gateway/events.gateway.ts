import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { safeRedisGet, safeRedisSetex } from '../common/redis/redis-safe.util';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { Namespace, Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientOptions } from 'redis';
import { redisTlsOptions } from '../common/redis/redis-tls.util';
import { socketIoCorsOptions } from './socket-cors.util';
import { StreamViewerService } from '../modules/streaming/stream-viewer.service';
import { StreamingService } from '../modules/streaming/streaming.service';
import { StreamReactionService } from '../modules/streaming/stream-reaction.service';
import { VideosService } from '../modules/content/videos.service';
import { CommunitiesService } from '../modules/communities/communities.service';
import { JwtPayload } from '../modules/auth/strategies/jwt.strategy';
import { UserRole } from '../modules/users/entities/user.entity';

type SocketAuthData = {
  userId?: string;
  role?: UserRole;
  watchingStreamId?: string;
};

@WebSocketGateway({
  cors: socketIoCorsOptions(),
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private userSockets = new Map<string, Set<string>>();
  private static readonly SOCKET_ACCESS_CACHE_TTL_SEC = 60;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly streamViewerService: StreamViewerService,
    private readonly streamingService: StreamingService,
    private readonly streamReactionService: StreamReactionService,
    private readonly videosService: VideosService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  async afterInit() {
    const url = this.configService.get<string>('redis.url');
    if (!url) {
      this.logger.warn('Redis URL missing; Socket.IO runs without Redis adapter (single replica only)');
      this.logger.log('WebSocket gateway initialized');
      return;
    }
    try {
      const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
      const clientOptions = this.redisSocketOptions(url, nodeEnv);
      const pubClient = createClient(clientOptions);
      const subClient = pubClient.duplicate();
      pubClient.on('error', (err) => this.logger.error(`Redis pub client: ${err.message}`));
      subClient.on('error', (err) => this.logger.error(`Redis sub client: ${err.message}`));
      await Promise.all([pubClient.connect(), subClient.connect()]);
      const io = this.socketIoServer();
      io.adapter(createAdapter(pubClient, subClient));
      this.logger.log('WebSocket gateway initialized with Redis adapter (multi-replica ready)');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Socket.IO Redis adapter failed (${msg}); continuing single-replica. Ensure REDIS_URL and Redis availability for horizontal scale.`,
      );
      this.logger.log('WebSocket gateway initialized');
    }
  }

  handleConnection(client: Socket) {
    let userId: string | null = null;
    try {
      userId = this.resolveUserId(client);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Socket ${client.id} auth failed: ${msg}`);
      client.disconnect(true);
      return;
    }
    if (userId) {
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      const data = client.data as SocketAuthData;
      data.userId = userId;
      data.role = this.resolveRole(client) ?? UserRole.USER;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketAuthData;
    const userId = data.userId;
    const watchingStreamId = data.watchingStreamId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
    }
    if (watchingStreamId) {
      void this.streamViewerService.leave(watchingStreamId, client.id).then((count) => {
        this.server
          .to(`stream:${watchingStreamId}`)
          .emit('stream:viewer-count', { streamId: watchingStreamId, viewerCount: count });
      });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private resolveRole(client: Socket): UserRole | null {
    const auth = client.handshake.auth as { token?: string };
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret || !auth.token) return null;
    try {
      const payload = this.jwtService.verify<JwtPayload>(auth.token, { secret });
      return payload.role;
    } catch {
      return null;
    }
  }

  private requireAuth(client: Socket): { userId: string; role: UserRole } {
    const data = client.data as SocketAuthData;
    if (!data.userId) {
      throw new WsException('Authentication required');
    }
    return { userId: data.userId, role: data.role ?? UserRole.USER };
  }

  private denyAccess(message = 'Access denied'): never {
    throw new WsException(message);
  }

  private async assertStreamAccess(
    streamId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const allowed = await this.streamingService.assertStreamSocketAccess(streamId, userId, role);
    if (!allowed) {
      this.denyAccess();
    }
  }

  private async assertVideoAccess(
    videoId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const cacheKey = `ent:video-access:${userId}:${videoId}`;
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached === '1') return;
    if (cached === '0') this.denyAccess();

    try {
      const video = await this.videosService.getVideoForViewer(videoId, userId, role);
      const allowed = !video.accessDenied;
      await safeRedisSetex(
        this.redis,
        cacheKey,
        EventsGateway.SOCKET_ACCESS_CACHE_TTL_SEC,
        allowed ? '1' : '0',
        this.logger,
      );
      if (!allowed) {
        this.denyAccess();
      }
    } catch (err) {
      if (err instanceof ForbiddenException) {
        this.denyAccess();
      }
      throw err;
    }
  }

  private async assertChannelAccess(
    channelId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const cacheKey = `ent:channel-access:${userId}:${channelId}`;
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached === '1') return;
    if (cached === '0') this.denyAccess();

    try {
      await this.communitiesService.verifyChannelAccess(channelId, userId, role);
      await safeRedisSetex(
        this.redis,
        cacheKey,
        EventsGateway.SOCKET_ACCESS_CACHE_TTL_SEC,
        '1',
        this.logger,
      );
    } catch (err) {
      if (err instanceof ForbiddenException) {
        await safeRedisSetex(
          this.redis,
          cacheKey,
          EventsGateway.SOCKET_ACCESS_CACHE_TTL_SEC,
          '0',
          this.logger,
        );
        this.denyAccess();
      }
      throw err;
    }
  }

  private resolveUserId(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string; userId?: string };
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret) return null;

    if (auth.token) {
      try {
        const payload = this.jwtService.verify<{ sub: string }>(auth.token, { secret });
        return payload.sub;
      } catch {
        return null;
      }
    }

    // Legacy clients — ignore unverified userId (do not join user room)
    if (auth.userId) {
      this.logger.warn(`Socket ${client.id} connected with legacy userId auth; use token instead`);
    }
    return null;
  }

  @SubscribeMessage('join-live-feed')
  handleJoinLiveFeed(@ConnectedSocket() client: Socket) {
    this.requireAuth(client);
    client.join('streams:live');
    return { event: 'joined-live-feed', data: { ok: true } };
  }

  @SubscribeMessage('leave-live-feed')
  handleLeaveLiveFeed(@ConnectedSocket() client: Socket) {
    client.leave('streams:live');
  }

  @SubscribeMessage('join-stream')
  async handleJoinStream(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertStreamAccess(data.streamId, userId, role);
    client.join(`stream:${data.streamId}`);
    (client.data as SocketAuthData).watchingStreamId = data.streamId;
    const count = await this.streamViewerService.join(data.streamId, client.id, userId);
    this.server
      .to(`stream:${data.streamId}`)
      .emit('stream:viewer-count', { streamId: data.streamId, viewerCount: count });
    return { event: 'joined-stream', data: { streamId: data.streamId, viewerCount: count } };
  }

  @SubscribeMessage('join-video')
  async handleJoinVideo(
    @MessageBody() data: { videoId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertVideoAccess(data.videoId, userId, role);
    client.join(`video:${data.videoId}`);
    return { event: 'joined-video', data: { videoId: data.videoId } };
  }

  @SubscribeMessage('leave-stream')
  async handleLeaveStream(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`stream:${data.streamId}`);
    const clientData = client.data as SocketAuthData;
    if (clientData.watchingStreamId === data.streamId) {
      delete clientData.watchingStreamId;
    }
    const count = await this.streamViewerService.leave(data.streamId, client.id);
    this.server
      .to(`stream:${data.streamId}`)
      .emit('stream:viewer-count', { streamId: data.streamId, viewerCount: count });
  }

  @SubscribeMessage('leave-video')
  handleLeaveVideo(@MessageBody() data: { videoId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`video:${data.videoId}`);
  }

  @OnEvent('video.ready')
  handleVideoReady(payload: {
    videoId: string;
    userId: string;
    status?: string;
    hlsUrl?: string;
    thumbnailUrl?: string;
  }) {
    const body = {
      videoId: payload.videoId,
      status: payload.status ?? 'ready',
      hlsUrl: payload.hlsUrl,
      thumbnailUrl: payload.thumbnailUrl,
      message: 'Your video is ready!',
    };
    this.server.to(`user:${payload.userId}`).emit('video:ready', body);
    this.server.to(`video:${payload.videoId}`).emit('video:ready', body);
  }

  @OnEvent('stream.started')
  handleStreamStarted(payload: { streamId: string; userId: string; title: string }) {
    void this.streamingService.invalidateStreamListCache();
    this.server.to('streams:live').emit('stream:started', payload);
    this.server.to(`stream:${payload.streamId}`).emit('stream:started', payload);
    this.server.to(`user:${payload.userId}`).emit('stream:started', payload);
  }

  @OnEvent('stream.ended')
  handleStreamEnded(payload: { streamId: string; userId: string; title: string }) {
    void this.streamingService.invalidateStreamListCache();
    this.server.to('streams:live').emit('stream:ended', payload);
    this.server.to(`stream:${payload.streamId}`).emit('stream:ended', payload);
    this.server.to(`user:${payload.userId}`).emit('stream:ended', payload);
  }

  @OnEvent('comment.created')
  handleCommentCreated(payload: { videoId: string; comment: unknown }) {
    this.server.to(`video:${payload.videoId}`).emit('comment:new', payload.comment);
  }

  @OnEvent('stream.chat.message')
  handleStreamChatMessage(payload: { streamId: string; message: unknown }) {
    this.server.to(`stream:${payload.streamId}`).emit('stream:chat:message', payload.message);
  }

  @OnEvent('stream.chat.delete')
  handleStreamChatDelete(payload: { streamId: string; messageId: string }) {
    this.server.to(`stream:${payload.streamId}`).emit('stream:chat:delete', payload);
  }

  @OnEvent('stream.slow-mode')
  handleStreamSlowMode(payload: { streamId: string; slowModeSeconds: number }) {
    this.server.to(`stream:${payload.streamId}`).emit('stream:chat:slow-mode', payload);
  }

  @OnEvent('stream.chat.pinned')
  handleStreamChatPinned(payload: { streamId: string; messageId: string | null }) {
    this.server.to(`stream:${payload.streamId}`).emit('stream:chat:pinned', payload);
  }

  @OnEvent('stream.chat.settings')
  handleStreamChatSettings(payload: {
    streamId: string;
    chatEnabled: boolean;
    chatMode: string;
  }) {
    this.server.to(`stream:${payload.streamId}`).emit('stream:chat:settings', payload);
  }

  @OnEvent('stream.poll.updated')
  handleStreamPollUpdated(payload: { streamId: string; poll: unknown }) {
    this.server.to(`stream:${payload.streamId}`).emit('stream:poll:updated', payload);
  }

  @OnEvent('channel.message')
  handleChannelMessage(payload: { channelId: string; message: unknown }) {
    this.server.to(`channel:${payload.channelId}`).emit('channel:message', payload.message);
  }

  @OnEvent('channel.message.deleted')
  handleChannelMessageDeleted(payload: { channelId: string; messageId: string }) {
    this.server.to(`channel:${payload.channelId}`).emit('channel:message:delete', payload);
  }

  @OnEvent('notification.created')
  handleNotificationCreated(payload: { userId: string; notification: unknown }) {
    this.server.to(`user:${payload.userId}`).emit('notification:new', payload.notification);
  }

  @OnEvent('direct-message.sent')
  handleDirectMessageSent(payload: { conversationId: string; message: unknown; recipientIds: string[] }) {
    for (const userId of payload.recipientIds) {
      this.server.to(`user:${userId}`).emit('dm:message', payload.message);
    }
    this.server.to(`conversation:${payload.conversationId}`).emit('dm:message', payload.message);
  }

  @OnEvent('stream.reaction')
  handleStreamReaction(payload: { streamId: string; reaction: string; count: number }) {
    this.server.to(`stream:${payload.streamId}`).emit('stream:reaction', payload);
  }

  @SubscribeMessage('stream:react')
  async handleStreamReact(
    @MessageBody() data: { streamId: string; reaction: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertStreamAccess(data.streamId, userId, role);
    const reaction = (data.reaction || 'heart').slice(0, 32);
    const result = await this.streamReactionService.react(data.streamId, reaction);
    return { event: 'stream:reaction', data: { streamId: data.streamId, ...result } };
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId } = this.requireAuth(client);
    // Membership verified on REST; socket join is best-effort for realtime
    client.join(`conversation:${data.conversationId}`);
    return { event: 'joined-conversation', data: { conversationId: data.conversationId, userId } };
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('join-stream-chat')
  async handleJoinStreamChat(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertStreamAccess(data.streamId, userId, role);
    client.join(`stream:${data.streamId}`);
    return { event: 'joined-stream-chat', data: { streamId: data.streamId } };
  }

  @SubscribeMessage('leave-stream-chat')
  handleLeaveStreamChat(@MessageBody() data: { streamId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`stream:${data.streamId}`);
  }

  @SubscribeMessage('join-channel')
  async handleJoinChannel(
    @MessageBody() data: { channelId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertChannelAccess(data.channelId, userId, role);
    client.join(`channel:${data.channelId}`);
    return { event: 'joined-channel', data: { channelId: data.channelId } };
  }

  @SubscribeMessage('leave-channel')
  handleLeaveChannel(@MessageBody() data: { channelId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`channel:${data.channelId}`);
  }

  emitToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }

  /** Nest may expose the namespace or root Server; adapter must attach to the root IO instance. */
  private socketIoServer(): Server {
    const srv = this.server;
    const parent = (srv as unknown as Namespace).server;
    if (parent && typeof parent.adapter === 'function') return parent;
    return srv;
  }

  private redisSocketOptions(url: string, nodeEnv: string): RedisClientOptions {
    const options: RedisClientOptions = { url };
    const tls = redisTlsOptions(url, nodeEnv);
    if (tls) {
      options.socket = {
        tls: true,
        rejectUnauthorized: tls.tls.rejectUnauthorized,
      };
    }
    return options;
  }
}
