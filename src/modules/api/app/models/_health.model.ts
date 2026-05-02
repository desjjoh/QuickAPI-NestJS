import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Whether the server is currently alive.',
    example: true,
  })
  public readonly alive!: boolean;

  @ApiProperty({
    description: 'Server uptime in seconds.',
    example: 12.345,
  })
  public readonly uptime!: number;

  @ApiProperty({
    description: 'Current server timestamp in ISO-8601 format.',
    example: '2025-12-07T21:30:27.123Z',
  })
  public readonly timestamp!: string;

  constructor(alive: boolean, uptime: number, timestamp: string) {
    this.alive = alive;
    this.uptime = uptime;
    this.timestamp = timestamp;
  }
}
