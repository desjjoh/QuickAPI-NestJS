import { ApiProperty } from '@nestjs/swagger';

export type InfoResponseParams = {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  hostname: string;
  pid: number;
};

export class InfoResponseDto {
  @ApiProperty({
    description: 'Application name.',
    example: 'quickapi',
  })
  public readonly name: string;

  @ApiProperty({
    description: 'Application semantic version.',
    example: '1.0.0',
    pattern:
      '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[\\da-z-]+(?:\\.[\\da-z-]+)*)?(?:\\+[\\da-z-]+(?:\\.[\\da-z-]+)*)?$',
  })
  public readonly version: string;

  @ApiProperty({
    description: 'Current environment mode.',
    example: 'development',
    enum: ['development', 'production', 'test'],
  })
  public readonly environment: 'development' | 'production' | 'test';

  @ApiProperty({
    description: 'Server hostname.',
    example: 'server-001',
  })
  public readonly hostname: string;

  @ApiProperty({
    description: 'Process ID.',
    example: 12345,
  })
  public readonly pid: number;

  constructor(params: InfoResponseParams) {
    this.name = params.name;
    this.version = params.version;
    this.environment = params.environment;
    this.hostname = params.hostname;
    this.pid = params.pid;
  }
}
