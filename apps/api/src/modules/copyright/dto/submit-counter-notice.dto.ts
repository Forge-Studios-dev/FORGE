import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitCounterNoticeDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  contactInfo: string;

  @ApiProperty({
    description:
      'Must be true: "I have a good faith belief that the material was removed or disabled as ' +
      'a result of a mistake or misidentification of the material to be removed or disabled."',
  })
  @Equals(true)
  goodFaithMistakeStatement: boolean;

  @ApiProperty({
    description:
      'Must be true: consent to the jurisdiction of the claimant’s federal district court ' +
      '(or, if outside the US, an appropriate judicial district).',
  })
  @Equals(true)
  consentToJurisdiction: boolean;

  @ApiProperty({ description: 'Typed full legal name as electronic signature' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  signature: string;
}
