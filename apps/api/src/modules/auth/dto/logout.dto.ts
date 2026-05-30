import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Revoke all devices; default is current device only' })
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;
}
