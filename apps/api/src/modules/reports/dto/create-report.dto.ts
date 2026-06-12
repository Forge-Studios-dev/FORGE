import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ['video', 'user', 'comment'] })
  @IsIn(['video', 'user', 'comment'])
  targetType: 'video' | 'user' | 'comment';

  @ApiProperty()
  @IsUUID()
  targetId: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason: string;
}
