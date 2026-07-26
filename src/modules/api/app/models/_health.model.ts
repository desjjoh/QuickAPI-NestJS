import { ApiProperty } from '@nestjs/swagger';

export type HealthStatus = 'alive' | 'dead';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Whether this application process is alive.',
    example: true,
  })
  public readonly alive: boolean;

  @ApiProperty({
    description: 'In-process liveness state. Dependencies are not checked.',
    example: 'alive',
    enum: ['alive', 'dead'],
  })
  public readonly status: HealthStatus;

  @ApiProperty({ description: 'Process uptime in seconds.', example: 12.345 })
  public readonly uptime: number;

  @ApiProperty({
    description: 'Snapshot time in ISO-8601 format.',
    example: '2026-07-26T10:15:30.000Z',
  })
  public readonly timestamp: string;

  constructor(alive: boolean, uptime: number, timestamp: string) {
    this.alive = alive;
    this.status = alive ? 'alive' : 'dead';
    this.uptime = uptime;
    this.timestamp = timestamp;
  }
}
