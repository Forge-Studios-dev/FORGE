import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ description: 'Set false to disable sign-in' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      "Step-up auth (MED-13): the calling admin's own current password, required when role is being set to admin",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentAdminPassword?: string;
}
