import { Controller, Get, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from '@nestjs/swagger/dist/decorators';
import type { Response } from 'express';

import {
  RootResponseDto,
  HealthResponseDto,
  ReadyResponseDto,
  InfoResponseDto,
  SystemResponseDto,
} from '../models';
import { ApplicationControllerService } from '../services/application.service';
import { metricsRegistry } from '@/config/metrics.config';

@Controller()
export class ApplicationController {
  constructor(private readonly svc: ApplicationControllerService) {}

  // GET /
  @Get('')
  @ApiOperation({
    summary: 'Return a simple greeting message.',
    description: 'Root endpoint showing application greeting.',
  })
  @ApiOkResponse({ description: 'Greeting message.', type: RootResponseDto })
  async get_root(): Promise<RootResponseDto> {
    return this.svc.get_root('Hello World! Welcome to NestJS');
  }

  // GET /health
  @Get('/health')
  @ApiOperation({
    summary: 'Report basic process liveness.',
    description: 'Liveness check — verifies the process is alive.',
  })
  @ApiOkResponse({
    description: 'Liveness information.',
    type: HealthResponseDto,
  })
  async get_health(): Promise<HealthResponseDto> {
    return this.svc.get_health();
  }

  // GET /ready
  @Get('/ready')
  @ApiOperation({
    summary: 'Report application readiness state.',
    description:
      'Readiness check — verifies that the app has completed startup and all required services are healthy.',
  })
  @ApiOkResponse({
    description: 'Application is ready.',
    type: ReadyResponseDto,
  })
  async get_ready(): Promise<ReadyResponseDto> {
    return this.svc.get_ready();
  }

  // GET /info
  @Get('/info')
  @ApiOperation({
    summary: 'Return application and runtime metadata.',
    description:
      'Returns application metadata including name, version, environment, hostname, and PID.',
  })
  @ApiOkResponse({
    description: 'Application information.',
    type: InfoResponseDto,
  })
  async get_info(): Promise<InfoResponseDto> {
    return this.svc.get_info();
  }

  // GET /system
  @Get('/system')
  @ApiOperation({
    summary: 'Return system-level diagnostics.',
    description:
      'System diagnostics including memory usage, load averages, event loop lag, and database status.',
  })
  @ApiOkResponse({
    description: 'System diagnostics snapshot.',
    type: SystemResponseDto,
  })
  get_system(): Promise<SystemResponseDto> {
    return this.svc.get_system();
  }

  // GET /metrics
  @Get('/metrics')
  @ApiOperation({
    summary: 'Expose Prometheus-formatted metrics.',
    description: 'Prometheus metrics in plaintext exposition format. Not JSON.',
  })
  @ApiProduces('text/plain')
  @ApiOkResponse({
    description: 'Prometheus metrics (text/plain).',
    schema: {
      type: 'string',
      example:
        '# HELP http_requests_total Total HTTP requests\n' +
        '# TYPE http_requests_total counter\n' +
        'http_requests_total{method="GET",path="/ready",status="200"} 42',
    },
  })
  async get_metrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  }
}
