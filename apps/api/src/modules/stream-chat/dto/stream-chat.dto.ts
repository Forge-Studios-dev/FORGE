import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class TimeoutUserDto {
  @ApiProperty()
  @IsUUID()
  targetUserId: string;

  @ApiPropertyOptional({ description: 'Timeout duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(30)
  durationSeconds?: number;
}
