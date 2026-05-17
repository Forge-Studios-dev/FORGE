import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestCreatorDto {
  @ApiPropertyOptional({ description: 'Short pitch or note for creator application review' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
