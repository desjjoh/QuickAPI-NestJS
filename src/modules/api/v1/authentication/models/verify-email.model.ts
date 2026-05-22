import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'V8nYk2QpL4sR7xZa',
    description: 'The unique NanoID of the email verification token record.',
    minLength: 16,
    maxLength: 16,
    pattern: '^[0-9A-Za-z]{16}$',
  })
  @IsString()
  @Length(16, 16)
  public readonly token_id!: string;

  @ApiProperty({
    example: 'A9x4bW8rN2Yp7sQmL6zT0cF3vH1jK5uDqE8iRoP',
    description:
      'The raw one-time email verification token sent to the user. The API hashes this value before comparison.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly token!: string;
}

export class ResendVerificationDto {
  @ApiProperty({
    example: 'jane.doe@example.com',
    description:
      'The email address for the account that should receive a new verification email.',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  public readonly email!: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty({
    example: 'Email address verified successfully.',
    description: 'Human-readable confirmation message.',
  })
  public readonly message: string;

  public constructor(data: VerifyEmailResponseDto) {
    this.message = data.message;
  }
}

export class ResendVerificationResponseDto {
  @ApiProperty({
    example:
      'If an account exists and requires verification, a verification email will be sent.',
    description:
      'Generic response message. This avoids revealing whether an email address is registered.',
  })
  public readonly message: string;

  public constructor(data: ResendVerificationResponseDto) {
    this.message = data.message;
  }
}
