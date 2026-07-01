import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Equals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers and underscores' })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter and one number',
  })
  password: string;

  @ApiProperty({ description: 'Must be true — user accepted Terms and Privacy Policy' })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms of Service and Privacy Policy' })
  acceptedTerms: boolean;

  @ApiProperty({ description: 'Optional referral code from an existing user', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  referralCode?: string;
}
