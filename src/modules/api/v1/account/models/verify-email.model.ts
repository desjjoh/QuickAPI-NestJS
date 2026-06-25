import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'V8nYk2QpL4sR7xZa',
    description: 'The unique NanoID of the email verification token record.',
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
      'The raw one-time email verification token sent to the user. The API hashes this value before comparison.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly token!: string;
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
