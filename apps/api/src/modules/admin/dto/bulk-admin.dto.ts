import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';
import { ReportStatus } from '../../reports/entities/report.entity';

/** Shared cap on bulk-action batch size — keeps a single admin action bounded regardless of selection UI. */
const MAX_BULK_IDS = 200;

export class BulkIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_IDS)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BulkUpdateUsersDto extends BulkIdsDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description:
      "Step-up auth (MED-13): the calling admin's own current password, required when role is being set to admin for at least one target",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentAdminPassword?: string;
}

export class BulkRejectCreatorsDto extends BulkIdsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BulkUpdateReportsDto extends BulkIdsDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;
}
