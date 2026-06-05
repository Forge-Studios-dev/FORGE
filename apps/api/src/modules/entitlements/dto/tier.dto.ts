import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'Stripe Price ID (price_...) for paid checkout' })
  @IsOptional()
  @IsString()
  @Matches(/^price_/, { message: 'stripePriceId must be a Stripe Price ID (price_...)' })
  stripePriceId?: string;
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

  @ApiPropertyOptional({ description: 'Stripe Price ID (price_...) for paid checkout' })
  @IsOptional()
  @IsString()
  @Matches(/^price_/, { message: 'stripePriceId must be a Stripe Price ID (price_...)' })
  stripePriceId?: string;
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
}
