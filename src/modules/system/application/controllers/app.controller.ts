import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger/dist/decorators';

import { LifecycleHandler } from '@/handlers/lifecycle.handler';

import { RootResponseDto } from '../dtos/root.dto';
import { HealthResponseDto } from '../dtos/health.dto';

@Controller()
export class AppController {
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
    return new RootResponseDto('Hello World! Welcome to NestJS');
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
    const alive: boolean = LifecycleHandler.isAlive();
    const uptime: number = Number(process.uptime().toFixed(3));
    const timestamp: string = new Date().toISOString();

    return new HealthResponseDto(alive, uptime, timestamp);
  }
}
