import { ApiProperty } from '@nestjs/swagger';

import { DependencyCheckDto } from './_ready.model';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Whether the process is accepting health checks.',
    example: true,
  })
  public readonly alive: boolean;

  @ApiProperty({
    description: 'Aggregate application and dependency health state.',
    example: 'healthy',
    enum: ['healthy', 'degraded', 'unhealthy'],
  })
  public readonly status: HealthStatus;

  @ApiProperty({ description: 'Process uptime in seconds.', example: 12.345 })
  public readonly uptime: number;

  @ApiProperty({
    description: 'Snapshot time in ISO-8601 format.',
    example: '2026-07-26T10:15:30.000Z',
  })
  public readonly timestamp: string;

  @ApiProperty({
    description: 'Individual service dependency health checks.',
    type: () => [DependencyCheckDto],
  })
  public readonly checks: DependencyCheckDto[];

  constructor(
    alive: boolean,
    uptime: number,
    timestamp: string,
    checks: DependencyCheckDto[] = [],
  ) {
    this.alive = alive;
    this.status = alive
      ? checks.every((check) => check.status === 'up')
        ? 'healthy'
        : 'degraded'
      : 'unhealthy';
    this.uptime = uptime;
    this.timestamp = timestamp;
    this.checks = checks;
  }
}
