import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { Namespace, Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientOptions } from 'redis';
import { redisTlsOptions } from '../common/redis/redis-tls.util';
import { socketIoCorsOptions } from './socket-cors.util';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
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
      (client.data as { userId?: string }).userId = userId;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string }).userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
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
    client.join('streams:live');
    return { event: 'joined-live-feed', data: { ok: true } };
  }

  @SubscribeMessage('leave-live-feed')
  handleLeaveLiveFeed(@ConnectedSocket() client: Socket) {
    client.leave('streams:live');
  }

  @SubscribeMessage('join-stream')
  handleJoinStream(@MessageBody() data: { streamId: string }, @ConnectedSocket() client: Socket) {
    client.join(`stream:${data.streamId}`);
    return { event: 'joined-stream', data: { streamId: data.streamId } };
  }

  @SubscribeMessage('join-video')
  handleJoinVideo(@MessageBody() data: { videoId: string }, @ConnectedSocket() client: Socket) {
    client.join(`video:${data.videoId}`);
    return { event: 'joined-video', data: { videoId: data.videoId } };
  }

  @SubscribeMessage('leave-stream')
  handleLeaveStream(@MessageBody() data: { streamId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`stream:${data.streamId}`);
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
    this.server.to('streams:live').emit('stream:started', payload);
    this.server.to(`stream:${payload.streamId}`).emit('stream:started', payload);
    this.server.to(`user:${payload.userId}`).emit('stream:started', payload);
  }

  @OnEvent('stream.ended')
  handleStreamEnded(payload: { streamId: string; userId: string; title: string }) {
    this.server.to('streams:live').emit('stream:ended', payload);
    this.server.to(`stream:${payload.streamId}`).emit('stream:ended', payload);
    this.server.to(`user:${payload.userId}`).emit('stream:ended', payload);
  }

  @OnEvent('comment.created')
  handleCommentCreated(payload: { videoId: string; comment: unknown }) {
    this.server.to(`video:${payload.videoId}`).emit('comment:new', payload.comment);
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
