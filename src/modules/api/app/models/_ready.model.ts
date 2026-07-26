import { ApiProperty } from '@nestjs/swagger';

export type CheckStatus = 'up' | 'down';

export class DependencyCheckDto {
  @ApiProperty({
    description: 'Unique name of the checked application dependency.',
    example: 'database',
  })
  public readonly name: string;

  @ApiProperty({
    description: 'Current availability state of the dependency.',
    example: 'up',
    enum: ['up', 'down'],
  })
  public readonly status: CheckStatus;

  @ApiProperty({
    description: 'Time taken to perform the check.',
    example: 1.25,
  })
  public readonly response_time_ms: number;

  constructor(name: string, status: CheckStatus, response_time_ms: number) {
    this.name = name;
    this.status = status;
    this.response_time_ms = response_time_ms;
  }
}

export class ReadyResponseDto {
  @ApiProperty({
    description: 'Whether the application can receive traffic.',
    example: true,
  })
  public readonly ready: boolean;

  @ApiProperty({
    description: 'Aggregate application readiness state.',
    example: 'ready',
    enum: ['ready', 'not_ready'],
  })
  public readonly status: 'ready' | 'not_ready';

  @ApiProperty({
    description: 'Snapshot time in ISO-8601 format.',
    example: '2026-07-26T10:15:30.000Z',
  })
  public readonly timestamp: string;

  @ApiProperty({
    description: 'Checks contributing to the aggregate readiness state.',
    type: () => [DependencyCheckDto],
  })
  public readonly checks: DependencyCheckDto[];

  constructor(
    ready: boolean,
    checks: DependencyCheckDto[] = [],
    timestamp: string = new Date().toISOString(),
  ) {
    this.ready = ready;
    this.status = ready ? 'ready' : 'not_ready';
    this.timestamp = timestamp;
    this.checks = checks;
  }
}
