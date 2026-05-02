import { ApiProperty } from '@nestjs/swagger';

export class RootResponseDto {
  @ApiProperty({
    description: 'Response message string',
    example: 'Hello World! Welcome to NestJS',
  })
  public readonly message!: string;

  constructor(message: string) {
    this.message = message;
  }
}
