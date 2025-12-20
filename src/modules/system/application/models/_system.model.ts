import { ApiProperty } from '@nestjs/swagger';

export type DbStatus = 'connected' | 'disconnected';

export type SystemResponseParams = {
  uptime: number;
  timestamp: number;
  event_loop_lag: number;
  db: 'connected' | 'disconnected';
};

export class SystemResponseDto {
  @ApiProperty({
    description: 'Application uptime in seconds.',
    example: 123.45,
    type: Number,
  })
  public readonly uptime!: number;

  @ApiProperty({
    description: 'Current timestamp in milliseconds since Unix epoch.',
    example: 1_732_133_579_791,
    type: Number,
  })
  public readonly timestamp!: number;

  @ApiProperty({
    description: 'Approximate event loop lag in milliseconds.',
    example: 3.21,
    type: Number,
  })
  public readonly event_loop_lag!: number;

  @ApiProperty({
    description: 'Database connectivity status.',
    example: 'connected',
    enum: ['connected', 'disconnected'],
  })
  public readonly db!: 'connected' | 'disconnected';

  constructor(params: SystemResponseParams) {
    this.uptime = params.uptime;
    this.timestamp = params.timestamp;
    this.event_loop_lag = params.event_loop_lag;
    this.db = params.db;
  }
}
