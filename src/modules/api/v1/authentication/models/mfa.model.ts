import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';

export class MfaChallengeResponseDto {
  @ApiProperty({ example: true })
  public readonly mfa_required = true;

  @ApiProperty({ example: 'mfaChallenge123' })
  public readonly challenge_id: string;

  @ApiProperty({ enum: MfaMethod, example: MfaMethod.EMAIL_OTP })
  public readonly method: MfaMethod;

  @ApiProperty({ example: '2026-07-24T12:10:00.000Z' })
  public readonly expires_at: Date;

  public constructor(data: Omit<MfaChallengeResponseDto, 'mfa_required'>) {
    this.challenge_id = data.challenge_id;
    this.method = data.method;
    this.expires_at = data.expires_at;
  }
}

export class VerifyMfaChallengeDto {
  @ApiProperty({ example: 'mfaChallenge123' })
  @IsString()
  @IsNotEmpty()
  public readonly challenge_id!: string;

  @ApiProperty({
    example: '123456',
    description: 'The six-digit code sent to the account email address.',
  })
  @IsString()
  @Matches(/^\d{6}$/)
  public readonly code!: string;
}
