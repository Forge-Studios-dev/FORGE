import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class IngestEventDto {
  @ApiPropertyOptional({ description: 'e.g. watch.progress, watch.complete' })
  @IsString()
  @MaxLength(128)
  eventName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  videoId?: string;
}
