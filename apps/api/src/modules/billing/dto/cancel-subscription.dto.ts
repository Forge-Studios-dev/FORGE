import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  creatorId: string;
}
