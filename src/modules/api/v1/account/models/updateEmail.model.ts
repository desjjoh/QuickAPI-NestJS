import { IsEmail, IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailDto {
  @ApiProperty({
    description:
      'The new email address you want to associate with your account.',
    example: 'new.email@example.com',
  })
  @IsEmail()
  public readonly email!: string;

  @ApiProperty({
    description:
      "The user's current password, required to authorize the email change.",
    example: 'CurrentP@ssword123!',
  })
  @IsString()
  public readonly password!: string;
}

export class UpdateEmailResponseDto {
  @ApiProperty({
    example:
      'Verification email sent. Please confirm the new email address to complete the change.',
    description:
      'Human-readable confirmation that the email change verification was sent.',
  })
  public readonly message: string;

  public constructor(data: UpdateEmailResponseDto) {
    this.message = data.message;
  }
}
