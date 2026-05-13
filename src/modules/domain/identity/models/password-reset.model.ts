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
