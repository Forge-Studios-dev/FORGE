import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelType } from '../../entitlements/entities/channel-type.enum';
import { CommunityType, CommunityVisibility } from '../entities/community.entity';
import { CommunityRoleType } from '../entities/community-role.entity';

export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ enum: CommunityVisibility })
  @IsOptional()
  @IsEnum(CommunityVisibility)
  visibility?: CommunityVisibility;

  @ApiPropertyOptional({
    enum: CommunityType,
    description: 'Community classification. Only STANDARD or EVENT may be set by creators.',
  })
  @IsOptional()
  @IsEnum(CommunityType)
  communityType?: CommunityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

export class UpdateCommunityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ enum: CommunityVisibility })
  @IsOptional()
  @IsEnum(CommunityVisibility)
  visibility?: CommunityVisibility;

  @ApiPropertyOptional({
    enum: CommunityType,
    description: 'Community classification. Only STANDARD or EVENT may be set by creators.',
  })
  @IsOptional()
  @IsEnum(CommunityType)
  communityType?: CommunityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string | null;
}

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ enum: ChannelType })
  @IsOptional()
  @IsEnum(ChannelType)
  type?: ChannelType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requiredTierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ChannelType })
  @IsOptional()
  @IsEnum(ChannelType)
  type?: ChannelType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requiredTierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class SendChannelMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class InviteChannelMemberDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}

export enum CommunityReportTargetType {
  MESSAGE = 'message',
  POST = 'post',
  POLL = 'poll',
  USER = 'user',
}

export class CreateReportDto {
  @ApiPropertyOptional({ enum: CommunityReportTargetType, default: CommunityReportTargetType.MESSAGE })
  @IsOptional()
  @IsEnum(CommunityReportTargetType)
  targetType?: CommunityReportTargetType;

  @ApiPropertyOptional()
  @ValidateIf((o) => (o.targetType ?? 'message') === CommunityReportTargetType.MESSAGE)
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => (o.targetType ?? 'message') === CommunityReportTargetType.MESSAGE)
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => (o.targetType ?? 'message') === CommunityReportTargetType.MESSAGE)
  @IsUUID()
  messageId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.targetType === CommunityReportTargetType.POST)
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.targetType === CommunityReportTargetType.POLL)
  @IsUUID()
  pollId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.targetType === CommunityReportTargetType.USER)
  @IsUUID()
  reportedUserId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

export class BanMemberDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: CommunityRoleType })
  @IsEnum(CommunityRoleType)
  role: CommunityRoleType;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'UUID of the member who will become the new owner' })
  @IsUUID()
  newOwnerId: string;
}
