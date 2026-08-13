import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Current password, required to confirm account deletion' })
  @IsString()
  @MinLength(1)
  currentPassword: string;
}
