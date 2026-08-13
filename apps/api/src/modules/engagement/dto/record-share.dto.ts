import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ShareChannel } from '../entities/share.entity';

const CHANNELS = Object.values(ShareChannel);

export class RecordShareDto {
  @ApiProperty({ enum: CHANNELS, required: false })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: ShareChannel;
}
