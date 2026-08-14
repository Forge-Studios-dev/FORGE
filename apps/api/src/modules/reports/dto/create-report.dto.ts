import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { REPORT_REASONS, ReportReason } from '@forge/shared-types';

export class CreateReportDto {
  @ApiProperty({ enum: ['video', 'user', 'comment'] })
  @IsIn(['video', 'user', 'comment'])
  targetType: 'video' | 'user' | 'comment';

  @ApiProperty()
  @IsUUID()
  targetId: string;

  @ApiProperty({
    description:
      'Free-text reason shown to reviewers. Clients typically send the picker preset ' +
      '(optionally with appended detail text) here — see reasonCategory for the clean, structured value.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason: string;

  @ApiProperty({
    enum: REPORT_REASONS,
    required: false,
    description:
      'Structured reason preset, drives admin-queue severity triage. Optional for backward ' +
      'compatibility with older clients; omitting it means the report defaults to the lowest severity.',
  })
  @IsOptional()
  @IsIn(REPORT_REASONS)
  reasonCategory?: ReportReason;
}
