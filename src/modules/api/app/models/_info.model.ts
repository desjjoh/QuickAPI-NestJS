import { ApiProperty } from '@nestjs/swagger';

import type { mode } from '@/config/environment.schema';

export type InfoResponseParams = {
  name: string;
  version: string;
  environment: mode;
  hostname: string;
  pid: number;
  node_version: string;
  platform: NodeJS.Platform;
  architecture: string;
  started_at: string;
  timezone: string;
};

export class InfoResponseDto implements InfoResponseParams {
  @ApiProperty({
    description: 'Configured application name.',
    example: 'quickapi',
  })
  public readonly name: string;

  @ApiProperty({
    description: 'Current application semantic version.',
    example: '1.1.0',
  })
  public readonly version: string;

  @ApiProperty({
    description: 'Environment in which the application is running.',
    example: 'production',
    enum: ['development', 'production', 'test'],
  })
  public readonly environment: mode;

  @ApiProperty({
    description: 'Hostname of the machine or container running the process.',
    example: 'api-server-001',
  })
  public readonly hostname: string;

  @ApiProperty({
    description: 'Operating-system process identifier.',
    example: 12345,
  })
  public readonly pid: number;

  @ApiProperty({
    description: 'Node.js runtime version.',
    example: 'v22.19.0',
  })
  public readonly node_version: string;

  @ApiProperty({
    description: 'Operating-system platform reported by Node.js.',
    example: 'linux',
  })
  public readonly platform: NodeJS.Platform;

  @ApiProperty({
    description: 'CPU architecture for which the Node.js binary was compiled.',
    example: 'x64',
  })
  public readonly architecture: string;

  @ApiProperty({
    description: 'Approximate process start time in ISO-8601 format.',
    example: '2026-07-26T10:15:30.000Z',
  })
  public readonly started_at: string;

  @ApiProperty({
    description: 'IANA timezone resolved for the application process.',
    example: 'Etc/UTC',
  })
  public readonly timezone: string;

  constructor(params: InfoResponseParams) {
    this.name = params.name;
    this.version = params.version;
    this.environment = params.environment;
    this.hostname = params.hostname;
    this.pid = params.pid;
    this.node_version = params.node_version;
    this.platform = params.platform;
    this.architecture = params.architecture;
    this.started_at = params.started_at;
    this.timezone = params.timezone;
  }
}
