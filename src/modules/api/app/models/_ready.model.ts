import { ApiProperty } from '@nestjs/swagger';

export class ReadyResponseDto {
  @ApiProperty({
    description: 'Whether the system is currently ready.',
    example: true,
  })
  public readonly ready!: boolean;

  constructor(ready: boolean) {
    this.ready = ready;
  }
}
