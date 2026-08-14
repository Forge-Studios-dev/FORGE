import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@forge/shared-types';

export class UpdatePrivacyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  watchHistoryPaused?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [String], enum: NOTIFICATION_CATEGORIES })
  @IsArray()
  @ArrayMaxSize(NOTIFICATION_CATEGORIES.length)
  @IsIn(NOTIFICATION_CATEGORIES, { each: true })
  mutedCategories: NotificationCategory[];

  @ApiProperty()
  @IsBoolean()
  emailDigest: boolean;
}

export class UpdateInterestsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  categoryIds: string[];
}
