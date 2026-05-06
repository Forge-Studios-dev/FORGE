import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlaylistDto {
  @ApiProperty({ example: 'React Hooks I want to revisit' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;
}

