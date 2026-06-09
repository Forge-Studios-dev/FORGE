import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { StreamChatMode } from '../entities/stream.entity';

export class SetStreamChatSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @ApiPropertyOptional({ enum: StreamChatMode })
  @IsOptional()
  @IsEnum(StreamChatMode)
  chatMode?: StreamChatMode;
}
