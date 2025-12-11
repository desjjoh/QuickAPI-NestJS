import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: 400,
    description: 'HTTP status code for the error.',
  })
  public readonly status!: number;

  @ApiProperty({
    example: 'Invalid request payload',
    description: 'Human-readable description of the error.',
  })
  public readonly message!: string;

  @ApiProperty({
    example: 175_517_280_000,
    description:
      'Unix timestamp (milliseconds since epoch) indicating when the error occurred.',
  })
  public readonly timestamp!: number;

  constructor(status: number, message: string) {
    this.status = status;
    this.message = message;
    this.timestamp = Date.now();
  }
}
