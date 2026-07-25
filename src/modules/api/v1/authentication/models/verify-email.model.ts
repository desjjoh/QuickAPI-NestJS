import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';

export class EmailVerificationChallengeDto {
  @ApiProperty({ example: 'emailVerificationChallenge123' })
  public readonly challenge_id: string;

  @ApiProperty({ enum: MfaMethod, example: MfaMethod.EMAIL_OTP })
  public readonly method: MfaMethod;

  @ApiProperty({ example: '2026-07-25T12:30:00.000Z' })
  public readonly expires_at: Date;

  public constructor(data: EmailVerificationChallengeDto) {
    this.challenge_id = data.challenge_id;
    this.method = data.method;
    this.expires_at = data.expires_at;
  }
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'emailVerificationChallenge123' })
  @IsString()
  @IsNotEmpty()
  public readonly challenge_id!: string;

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
