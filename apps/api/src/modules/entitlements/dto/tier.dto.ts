import {
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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingInterval } from '../entities/subscription-tier.entity';
import { TierEntitlementResourceType } from '../entities/tier-entitlement.entity';

export class CreateTierDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Max simultaneous premium devices (1–10)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentDevices?: number;

  @ApiPropertyOptional({ description: 'Max members allowed on this tier (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMembers?: number;
}

export class UpdateTierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Max simultaneous premium devices (1–10)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentDevices?: number;

  @ApiPropertyOptional({ description: 'Max members allowed on this tier (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMembers?: number;
}

export class CreateTierEntitlementDto {
  @ApiProperty({ enum: TierEntitlementResourceType })
  @IsEnum(TierEntitlementResourceType)
  resourceType: TierEntitlementResourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accessLevel?: string;
}

export class MockSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  creatorId: string;

  @ApiProperty()
  @IsUUID()
  tierId: string;

  @ApiPropertyOptional({ description: 'Days until expiry; omit for no expiry' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalSubscriptionId?: string;

  @ApiPropertyOptional({ description: 'Scope subscription to a single community' })
  @IsOptional()
  @IsUUID()
  communityId?: string;
}

export class AdminGrantSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  creatorId: string;

  @ApiProperty()
  @IsUUID()
  tierId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalSubscriptionId?: string;
}

export class CreatorGrantSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  tierId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  communityId?: string;
}
