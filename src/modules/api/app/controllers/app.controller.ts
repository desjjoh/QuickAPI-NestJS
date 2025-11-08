import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { AppService } from '../services/app.service';

@ApiTags('root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Default greeting endpoint' })
  @ApiOkResponse({
    description: 'Returns a static greeting or health message.',
    type: String,
    example: 'Hello, world!',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
