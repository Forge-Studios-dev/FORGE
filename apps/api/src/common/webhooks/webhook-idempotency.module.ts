import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from '../../modules/streaming/entities/webhook-event.entity';
import { WebhookIdempotencyService } from './webhook-idempotency.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent])],
  providers: [WebhookIdempotencyService],
  exports: [WebhookIdempotencyService],
})
export class WebhookIdempotencyModule {}
