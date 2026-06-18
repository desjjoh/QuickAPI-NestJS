import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetResponseDto {
  @ApiProperty({
    example:
      'If an account exists for this email, a password reset email will be sent.',
  })
  public readonly message: string;

  public constructor(data: RequestPasswordResetResponseDto) {
    this.message = data.message;
  }
}

export class ConfirmPasswordResetResponseDto {
  @ApiProperty({
    example: 'Password reset successfully.',
  })
  public readonly message: string;

  public constructor(data: ConfirmPasswordResetResponseDto) {
    this.message = data.message;
  }
}

export class ValidatePasswordResetTokenResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Indicates the password reset token exists, has not expired, has not been consumed, and matches the provided token value.',
  })
  public readonly valid: boolean;

  public constructor(data: ValidatePasswordResetTokenResponseDto) {
    this.valid = data.valid;
  }
}
