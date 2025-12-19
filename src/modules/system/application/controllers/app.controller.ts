import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger/dist/decorators';

import { LC } from '@/handlers/lifecycle.handler';

import { RootResponseDto, HealthResponseDto } from '../models';
import { AppService } from '../services/app.service';

@Controller()
export class AppController {
  constructor(private readonly service: AppService) {}

  // GET /
  @Get('')
  @ApiOperation({
    summary: 'Return a simple greeting message.',
    description: 'Root endpoint showing application greeting.',
  })
  @ApiOkResponse({
    description: 'Successfully returned greeting.',
    type: RootResponseDto,
  })
  get_root(): RootResponseDto {
    return this.service.get_root('Hello World! Welcome to NestJS');
  }

  // GET /health
  @Get('/health')
  @ApiOperation({
    summary: 'Report basic process liveness.',
    description: 'Liveness check — verifies the process is alive.',
  })
  @ApiOkResponse({
    description: 'Current liveness, uptime, and timestamp.',
    type: HealthResponseDto,
  })
  get_health(): HealthResponseDto {
    const alive: boolean = LC.isAlive();
    const uptime: number = Number(process.uptime().toFixed(3));
    const timestamp: string = new Date().toISOString();

    return new HealthResponseDto(alive, uptime, timestamp);
  }

  // GET /ready
  @Get('/ready')
  get_ready() {}

  // GET /info
  @Get('/info')
  get_info() {}

  // GET /system
  @Get('/system')
  get_system() {}

  // GET /metrics
  @Get('/metrics')
  get_metrics() {}
}
