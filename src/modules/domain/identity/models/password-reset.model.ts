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

export class VerifyPasswordResetCodeResponseDto {
  @ApiProperty({
    example: 'passwordResetChallenge123',
    description: 'Identifier for the verified password reset challenge.',
  })
  public readonly challenge_id: string;

  @ApiProperty({
    example: 'short-lived-reset-authorization',
    description:
      'Short-lived authorization that permits only the password change step. It does not authenticate the user.',
  })
  public readonly authorization: string;

  @ApiProperty({ example: '2026-07-25T12:10:00.000Z' })
  public readonly expires_at: Date;

  public constructor(data: VerifyPasswordResetCodeResponseDto) {
    this.challenge_id = data.challenge_id;
    this.authorization = data.authorization;
    this.expires_at = data.expires_at;
  }
}
