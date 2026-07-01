import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { StreamQuestionStatus } from '../entities/stream-message.entity';

export class SubmitQuestionDto {
  @ApiProperty({ description: 'The question text' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  body: string;
}

export class SetQuestionStatusDto {
  @ApiProperty({ enum: StreamQuestionStatus })
  @IsEnum(StreamQuestionStatus)
  status: StreamQuestionStatus;
}
