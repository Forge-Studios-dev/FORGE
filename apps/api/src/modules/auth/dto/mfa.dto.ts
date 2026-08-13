import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class MfaVerifyDto {
  @ApiProperty({ description: '6-digit TOTP code' })
  @IsString()
  @MinLength(6)
  code: string;
}

export class MfaLoginVerifyDto {
  @ApiProperty()
  @IsString()
  challengeToken: string;

  @ApiProperty({ description: '6-digit TOTP code, or a single-use backup code' })
  @IsString()
  @MinLength(6)
  code: string;
}

export class MfaDisableDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword: string;
}
