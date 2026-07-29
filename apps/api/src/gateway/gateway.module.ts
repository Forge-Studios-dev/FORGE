import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { EventsBroadcastListener } from './events-broadcast.listener';
import { SocketIoHub } from './socket-io.hub';
import { StreamingModule } from '../modules/streaming/streaming.module';
import { ContentModule } from '../modules/content/content.module';
import { CommunitiesModule } from '../modules/communities/communities.module';
import { DirectMessagesModule } from '../modules/direct-messages/direct-messages.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    forwardRef(() => StreamingModule),
    forwardRef(() => ContentModule),
    forwardRef(() => CommunitiesModule),
    forwardRef(() => DirectMessagesModule),
  ],
  providers: [SocketIoHub, EventsGateway, EventsBroadcastListener],
  exports: [EventsGateway, SocketIoHub],
})
export class GatewayModule {}
