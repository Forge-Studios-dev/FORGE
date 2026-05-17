import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConsumeImpersonationDto {
  @ApiProperty({ description: 'Short-lived impersonation token from admin panel' })
  @IsString()
  @MinLength(16)
  token: string;
}
