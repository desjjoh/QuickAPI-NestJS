import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ValidateEmailChangeTokenDto {
  @ApiProperty({
    example: 'A9x4bW8rN2Yp7sQmL6zT0cF3vH1jK5uDqE8iRoP',
    description:
      'The raw one-time email verification token sent to the user. The API hashes this value before comparison.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly token!: string;
}

export class VerifyEmailDto extends ValidateEmailChangeTokenDto {
  @ApiProperty({
    example: '123456',
    description:
      'The 6-digit verification code included in the email change email.',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Verification code must be exactly 6 digits.',
  })
  public readonly code!: string;
}

export class ValidateEmailChangeTokenResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Indicates the email change token exists, has not expired, has not been consumed, matches the provided token value, and contains email change metadata.',
  })
  public readonly valid: boolean;

  public constructor(data: ValidateEmailChangeTokenResponseDto) {
    this.valid = data.valid;
  }
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
