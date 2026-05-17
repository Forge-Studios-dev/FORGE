import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ['video', 'user'] })
  @IsIn(['video', 'user'])
  targetType: 'video' | 'user';

  @ApiProperty()
  @IsUUID()
  targetId: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason: string;
}
