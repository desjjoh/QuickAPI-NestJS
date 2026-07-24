import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class UpdateMfaDto {
  @ApiProperty({
    example: true,
    description: 'Whether email-based sign-in MFA should be enabled.',
  })
  @IsBoolean()
  public readonly enabled!: boolean;

  @ApiProperty({
    example: 'CurrentP@ssword123!',
    description: 'The current password required to change MFA settings.',
  })
  @IsString()
  public readonly password!: string;
}
