import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AudienceRequestType } from '../entities/stream-audience-request.entity';

export class AddStreamModeratorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Username without @ prefix' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username?: string;
}

export class CreateStreamPollDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  question: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options: string[];
}

export class VoteStreamPollDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  optionIndex: number;
}

export class CreateAudienceRequestDto {
  @ApiPropertyOptional({ enum: AudienceRequestType })
  @IsOptional()
  @IsEnum(AudienceRequestType)
  requestType?: AudienceRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RespondAudienceRequestDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;
}

export class CreateBreakoutRoomsDto {
  @ApiProperty()
  @IsInt()
  @Min(2)
  roomCount: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipantsPerRoom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  namingPrefix?: string;
}

export class AssignBreakoutRoomsDto {
  @ApiProperty()
  @IsUUID()
  communityId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  roomIds: string[];
}

export class EndBreakoutRoomsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  roomIds: string[];
}

export class AddCoHostDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}

export class SetVipTierDto {
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_obj, value) => value !== null && value !== undefined)
  @IsUUID()
  vipTierId?: string | null;
}
