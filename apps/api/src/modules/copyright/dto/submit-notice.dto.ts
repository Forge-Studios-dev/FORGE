import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SubmitCopyrightNoticeDto {
  @ApiProperty()
  @IsUUID()
  videoId: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  claimantName: string;

  @ApiProperty()
  @IsEmail()
  claimantEmail: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  claimantAddress: string;

  @ApiProperty({ description: 'Identification of the copyrighted work claimed to be infringed' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  workDescription: string;

  @ApiProperty({ description: 'Identification of the infringing material on FORGE' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  infringingDescription: string;

  @ApiProperty({
    description:
      'Must be true: "I have a good faith belief that use of the material in the manner ' +
      'complained of is not authorized by the copyright owner, its agent, or the law."',
  })
  @Equals(true)
  goodFaithStatement: boolean;

  @ApiProperty({
    description:
      'Must be true: "The information in this notification is accurate, and, under penalty of ' +
      'perjury, I am authorized to act on behalf of the copyright owner."',
  })
  @Equals(true)
  accuracyStatement: boolean;

  @ApiProperty({ description: 'Typed full legal name as electronic signature' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  signature: string;
}
