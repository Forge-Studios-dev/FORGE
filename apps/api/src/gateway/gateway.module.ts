import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { StreamingModule } from '../modules/streaming/streaming.module';

@Module({
  imports: [ConfigModule, JwtModule.register({}), forwardRef(() => StreamingModule)],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
