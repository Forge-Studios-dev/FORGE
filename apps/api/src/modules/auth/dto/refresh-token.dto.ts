import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Optional when forge_refresh HttpOnly cookie is sent' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
