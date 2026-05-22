import { ApiProperty } from '@nestjs/swagger';

export class SignOutResponseDto {
  @ApiProperty({
    example: 'Signed out successfully.',
    description: 'Human-readable confirmation message.',
  })
  public readonly message: string;

  public constructor(data: SignOutResponseDto) {
    this.message = data.message;
  }
}
