import { Controller, Get, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger/dist/decorators';
import type { Response } from 'express';

import { minute } from '@/common/constants/milliseconds.constants';
import { Throttle } from '@nestjs/throttler';
import { SecurityApiService } from '../services/security.service';
import { CsrfDto } from '../models/csrf.model';

@ApiTags('Request Security')
@Controller()
export class SecurityApiController {
  constructor(private readonly svc: SecurityApiService) {}

  // GET /csrf
  @Get('/csrf')
  @Throttle({ default: { limit: 10, ttl: 1 * minute } })
  @ApiOperation({
    summary: 'Issue CSRF token',
    description:
      'Generates a CSRF token pair. The server stores a signed secret in an httpOnly cookie and returns a CSRF token for request validation.',
  })
  @ApiOkResponse({
    description: 'CSRF token generated successfully.',
    type: CsrfDto,
  })
  async getCsrf(@Res({ passthrough: true }) res: Response): Promise<CsrfDto> {
    return this.svc.issueCsrf(res);
  }
}
