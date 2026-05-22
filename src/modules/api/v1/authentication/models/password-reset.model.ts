import { Match } from '@/common/validators/match.validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'jane.doe@example.com',
    description:
      'The email address for the account requesting a password reset.',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  public readonly email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({
    example: 'V8nYk2QpL4sR7xZa',
    description: 'The unique NanoID of the password reset token record.',
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
      'The raw one-time password reset token sent to the user. The API hashes this value before comparison.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly token!: string;

  @ApiProperty({
    example: 'NJccb2-OaJ0{bs;-',
    description:
      'New password. Must include uppercase, lowercase, number, and special character.',
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
  public readonly password!: string;

  @ApiProperty({
    description: 'Confirmation for the new password. Must match "password".',
    example: 'N3wP@ssw0rd123!',
  })
  @Match(ConfirmPasswordResetDto, (s: ConfirmPasswordResetDto) => s.password)
  public readonly confirm!: string;
}
