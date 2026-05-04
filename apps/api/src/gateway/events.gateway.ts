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
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private userSockets = new Map<string, Set<string>>();

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId as string;
    if (userId) {
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.auth.userId as string;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-stream')
  handleJoinStream(@MessageBody() data: { streamId: string }, @ConnectedSocket() client: Socket) {
    client.join(`stream:${data.streamId}`);
    return { event: 'joined-stream', data: { streamId: data.streamId } };
  }

  @SubscribeMessage('leave-stream')
  handleLeaveStream(@MessageBody() data: { streamId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`stream:${data.streamId}`);
  }

  @OnEvent('video.ready')
  handleVideoReady(payload: { videoId: string; userId: string }) {
    this.server.to(`user:${payload.userId}`).emit('video:ready', {
      videoId: payload.videoId,
      message: 'Your video is ready!',
    });
  }

  @OnEvent('stream.started')
  handleStreamStarted(payload: { streamId: string; userId: string; title: string }) {
    this.server.emit('stream:started', payload);
  }

  @OnEvent('comment.created')
  handleCommentCreated(payload: { videoId: string; comment: unknown }) {
    this.server.to(`video:${payload.videoId}`).emit('comment:new', payload.comment);
  }

  emitToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }
}
