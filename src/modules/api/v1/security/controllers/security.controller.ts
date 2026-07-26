import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Throttle } from '@nestjs/throttler';
import { SecurityApiService } from '../services/security.service';
import { CsrfDto } from '../models/csrf.model';
import { throttlePolicies } from '@/config/throttle-policy.config';

@ApiTags('Request Security')
@Controller()
export class SecurityApiController {
  constructor(private readonly svc: SecurityApiService) {}

  // GET /csrf
  @Get('/csrf')
  @Throttle({ default: throttlePolicies.csrf })
  @ApiOperation({
    summary: 'Issue CSRF token',
    description:
      'Generates a CSRF token pair. The server stores a signed secret in an httpOnly cookie and returns a CSRF token for request validation.',
  })
  @ApiOkResponse({
    description: 'CSRF token generated successfully.',
    type: CsrfDto,
  })
  public async getCsrf(
    @Res({ passthrough: true }) res: Response,
  ): Promise<CsrfDto> {
    return this.svc.issueCsrf(res);
  }
}
