import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Thin holder so domain `@OnEvent` broadcast listeners can emit without living
 * inside the WebSocket gateway class (M-B3 EventsGateway split).
 */
@Injectable()
export class SocketIoHub {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  get io(): Server | null {
    return this.server;
  }

  to(room: string) {
    if (!this.server) {
      throw new Error('Socket.IO server not initialized');
    }
    return this.server.to(room);
  }
}
