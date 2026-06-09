import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class GrantStreamAccessDto {
  @ApiPropertyOptional({ description: 'User ID to grant access' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Username to grant access (alternative to userId)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username?: string;

  @ApiPropertyOptional({ description: 'Optional note for audit trail' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
