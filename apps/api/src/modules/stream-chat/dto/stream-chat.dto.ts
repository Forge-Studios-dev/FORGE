import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class SendStreamChatDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class PinMessageDto {
  @ApiPropertyOptional({ description: 'Message ID to pin; omit or null to unpin' })
  @IsOptional()
  @IsUUID()
  messageId?: string | null;
}

export class TimeoutUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional({ description: 'Username without @ prefix' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  targetUsername?: string;

  @ApiPropertyOptional({ description: 'Timeout duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(30)
  durationSeconds?: number;
}
