import { ApiProperty } from '@nestjs/swagger';

import type { DbStatus } from '@/modules/system/database/types/database.types';

export type CpuMetrics = {
  cores: number;
  model: string;
  load_average: number[];
};

export class CpuMetricsDto implements CpuMetrics {
  @ApiProperty({ description: 'Number of logical CPU cores.', example: 8 })
  public readonly cores: number;

  @ApiProperty({
    description: 'Model reported for the first logical CPU.',
    example: 'Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz',
  })
  public readonly model: string;

  @ApiProperty({
    description: 'One, five, and fifteen minute system load averages.',
    example: [0.42, 0.37, 0.31],
    type: [Number],
  })
  public readonly load_average: number[];

  constructor(params: CpuMetrics) {
    this.cores = params.cores;
    this.model = params.model;
    this.load_average = params.load_average;
  }
}

export type MemoryMetrics = {
  total_bytes: number;
  free_bytes: number;
  used_bytes: number;
  used_percent: number;
};

export class MemoryMetricsDto implements MemoryMetrics {
  @ApiProperty({
    description: 'Total host memory in bytes.',
    example: 17_179_869_184,
  })
  public readonly total_bytes: number;

  @ApiProperty({
    description: 'Available host memory in bytes.',
    example: 6_442_450_944,
  })
  public readonly free_bytes: number;

  @ApiProperty({
    description: 'Currently used host memory in bytes.',
    example: 10_737_418_240,
  })
  public readonly used_bytes: number;

  @ApiProperty({
    description: 'Percentage of host memory currently used.',
    example: 62.5,
  })
  public readonly used_percent: number;

  constructor(params: MemoryMetrics) {
    this.total_bytes = params.total_bytes;
    this.free_bytes = params.free_bytes;
    this.used_bytes = params.used_bytes;
    this.used_percent = params.used_percent;
  }
}

export type ProcessMetrics = {
  rss_bytes: number;
  heap_total_bytes: number;
  heap_used_bytes: number;
  external_bytes: number;
  active_handles: number;
};

export class ProcessMetricsDto implements ProcessMetrics {
  @ApiProperty({
    description: 'Resident set size of the process in bytes.',
    example: 83_886_080,
  })
  public readonly rss_bytes: number;

  @ApiProperty({
    description: 'Total allocated V8 heap size in bytes.',
    example: 41_943_040,
  })
  public readonly heap_total_bytes: number;

  @ApiProperty({
    description: 'Currently used V8 heap size in bytes.',
    example: 28_311_552,
  })
  public readonly heap_used_bytes: number;

  @ApiProperty({
    description: 'Memory used by C++ objects bound to JavaScript objects.',
    example: 2_097_152,
  })
  public readonly external_bytes: number;

  @ApiProperty({
    description: 'Number of active resources keeping the event loop alive.',
    example: 12,
  })
  public readonly active_handles: number;

  constructor(params: ProcessMetrics) {
    this.rss_bytes = params.rss_bytes;
    this.heap_total_bytes = params.heap_total_bytes;
    this.heap_used_bytes = params.heap_used_bytes;
    this.external_bytes = params.external_bytes;
    this.active_handles = params.active_handles;
  }
}

export type OperatingSystemMetrics = {
  type: string;
  release: string;
  uptime: number;
};

export class OperatingSystemMetricsDto implements OperatingSystemMetrics {
  @ApiProperty({ description: 'Operating-system name.', example: 'Linux' })
  public readonly type: string;

  @ApiProperty({
    description: 'Operating-system release identifier.',
    example: '6.8.0-64-generic',
  })
  public readonly release: string;

  @ApiProperty({
    description: 'Operating-system uptime in seconds.',
    example: 864_000.25,
  })
  public readonly uptime: number;

  constructor(params: OperatingSystemMetrics) {
    this.type = params.type;
    this.release = params.release;
    this.uptime = params.uptime;
  }
}

export type SystemResponseParams = {
  uptime: number;
  timestamp: number;
  event_loop_lag: number;
  db: DbStatus;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  process: ProcessMetrics;
  os: OperatingSystemMetrics;
};

export class SystemResponseDto implements SystemResponseParams {
  @ApiProperty({
    description: 'Application process uptime in seconds.',
    example: 123.45,
  })
  public readonly uptime: number;

  @ApiProperty({
    description: 'Snapshot time in milliseconds since the Unix epoch.',
    example: 1_785_061_330_000,
  })
  public readonly timestamp: number;

  @ApiProperty({
    description: 'Approximate event-loop scheduling lag in milliseconds.',
    example: 1.275,
  })
  public readonly event_loop_lag: number;

  @ApiProperty({
    description: 'Current database connectivity state.',
    example: 'connected',
    enum: ['connected', 'disconnected'],
  })
  public readonly db: DbStatus;

  @ApiProperty({
    description: 'Host CPU details and load averages.',
    type: CpuMetricsDto,
  })
  public readonly cpu: CpuMetrics;

  @ApiProperty({
    description: 'Host-level memory utilization.',
    type: MemoryMetricsDto,
  })
  public readonly memory: MemoryMetrics;

  @ApiProperty({
    description: 'Node.js process memory and resource usage.',
    type: ProcessMetricsDto,
  })
  public readonly process: ProcessMetrics;

  @ApiProperty({
    description: 'Operating-system identity and uptime.',
    type: OperatingSystemMetricsDto,
  })
  public readonly os: OperatingSystemMetrics;

  constructor(params: SystemResponseParams) {
    this.uptime = params.uptime;
    this.timestamp = params.timestamp;
    this.event_loop_lag = params.event_loop_lag;
    this.db = params.db;
    this.cpu = params.cpu;
    this.memory = params.memory;
    this.process = params.process;
    this.os = params.os;
  }
}
