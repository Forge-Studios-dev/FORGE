import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddStreamModeratorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Username without @ prefix' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username?: string;
}

export class CreateStreamPollDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  question: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options: string[];
}

export class VoteStreamPollDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  optionIndex: number;
}
