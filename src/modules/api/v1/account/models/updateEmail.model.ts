import { IsEmail, IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

import { Match } from '@/common/validators/match.validator';

export class UpdateEmailDto {
  @ApiProperty({
    description:
      'The new email address you want to associate with your account.',
    example: 'new.email@example.com',
  })
  @IsEmail()
  public readonly email!: string;

  @ApiProperty({
    description: 'Confirmation for the new email address. Must match "email".',
    example: 'new.email@example.com',
  })
  @Match(UpdateEmailDto, (s: UpdateEmailDto) => s.email)
  public readonly confirm!: string;

  @ApiProperty({
    description:
      "The user's current password, required to authorize the email change.",
    example: 'CurrentP@ssword123!',
  })
  @IsString()
  public readonly password!: string;
}
