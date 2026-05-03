import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Match } from '@/common/validators/match.validator';

export class UpdatePasswordDto {
  @ApiProperty({
    description:
      "The user's current password, used to verify identity before changing it.",
    example: 'CurrentP@ssw0rd!',
  })
  @IsString()
  public readonly password!: string;

  @ApiProperty({
    example: 'N3wP@ssw0rd123!',
    description:
      'Password must be 8 to 16 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
    minLength: 8,
    maxLength: 16,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/\d/, {
    message: 'Password must include at least one number.',
  })
  @Matches(/[a-z]/, {
    message: 'Password must include at least one lowercase letter.',
  })
  @Matches(/[A-Z]/, {
    message: 'Password must include at least one uppercase letter.',
  })
  @Matches(/[^\w\s]/, {
    message: 'Password must include at least one special character.',
  })
  public readonly new_password!: string;

  @ApiProperty({
    description:
      'Confirmation for the new password. Must match "new_password".',
    example: 'N3wP@ssw0rd123!',
  })
  @Match(UpdatePasswordDto, (s: UpdatePasswordDto) => s.new_password)
  public readonly confirm!: string;
}
