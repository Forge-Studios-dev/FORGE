import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({
    description:
      'Current password. Required unless the account has no usable password (Google-OAuth-only) — those accounts must pass confirmationToken instead.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  currentPassword?: string;

  @ApiPropertyOptional({
    description:
      'Short-lived token from POST /auth/account-deletion/request, emailed to the account address. Used in place of currentPassword for Google-OAuth-only accounts.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  confirmationToken?: string;
}
