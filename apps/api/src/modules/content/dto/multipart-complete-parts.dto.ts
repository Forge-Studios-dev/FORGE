import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class MultipartPartEtagDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(10_000)
  partNumber: number;

  @ApiProperty({ example: '"d41d8cd98f00b204e9800998ecf8427e"' })
  @IsString()
  etag: string;
}

export class MultipartCompletePartsDto {
  @ApiProperty({ type: [MultipartPartEtagDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MultipartPartEtagDto)
  parts: MultipartPartEtagDto[];
}
