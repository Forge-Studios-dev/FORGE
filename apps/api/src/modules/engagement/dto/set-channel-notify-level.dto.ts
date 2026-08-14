import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { FollowNotifyLevel } from '../entities/follow.entity';

export class SetChannelNotifyLevelDto {
  @ApiProperty({ enum: FollowNotifyLevel })
  @IsEnum(FollowNotifyLevel)
  notifyLevel: FollowNotifyLevel;
}
