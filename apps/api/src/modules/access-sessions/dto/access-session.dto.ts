import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AccessSessionType {
  PLAYBACK = 'playback',
  LIVE = 'live',
  COURSE = 'course',
  COMMUNITY = 'community',
}

export class StartAccessSessionDto {
  @ApiProperty({ enum: AccessSessionType })
  @IsEnum(AccessSessionType)
  sessionType: AccessSessionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Terminate prior session instead of returning conflict' })
  @IsOptional()
  force?: boolean;

  @ApiPropertyOptional({ description: 'Creator scope for per-tier device limits' })
  @IsOptional()
  @IsUUID()
  creatorId?: string;
}

export class HeartbeatAccessSessionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  sessionToken: string;
}
