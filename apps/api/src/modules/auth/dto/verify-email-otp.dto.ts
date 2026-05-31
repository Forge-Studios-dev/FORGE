import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailOtpDto {
  @ApiProperty({ example: 'creator@forgestudios.net' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit code from verification email' })
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}
