import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { MultipartPartEtagDto } from './multipart-complete-parts.dto';

export class MultipartCheckpointDto {
  @ApiProperty({ type: [MultipartPartEtagDto], description: 'Newly completed parts to merge into session' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MultipartPartEtagDto)
  parts: MultipartPartEtagDto[];
}
