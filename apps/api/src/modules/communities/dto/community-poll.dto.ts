import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateCommunityPollDto {
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

export class VoteCommunityPollDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  optionIndex: number;
}
