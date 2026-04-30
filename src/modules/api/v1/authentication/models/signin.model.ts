import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignInDto {
  @ApiProperty({
    example: 'chuck.tester@example.com',
    description:
      'The email address used to identify and sign in to the account.',
    maxLength: 254,
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  public readonly email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'The password used to sign in to the account.',
    minLength: 8,
    maxLength: 16,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(16)
  public readonly password!: string;
}
