import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { DevicePlatform } from '../entities/device-token.entity';

export class RegisterDeviceDto {
  @ApiProperty({ enum: ['web', 'android', 'ios'] })
  @IsIn(['web', 'android', 'ios'])
  platform: DevicePlatform;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  fcmToken: string;
}
