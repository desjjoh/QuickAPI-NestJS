import { timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { env } from '@/config/environment.config';

abstract class OperationsGuard implements CanActivate {
  protected abstract enabled(): boolean;

  canActivate(context: ExecutionContext): boolean {
    if (env.NODE_ENV === 'development') return true;

    if (!this.enabled()) throw new NotFoundException();

    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.header('x-operations-key');
    const expected = env.OPERATIONS_TOKEN;

    if (!supplied || !expected || !this.matches(supplied, expected)) {
      throw new UnauthorizedException('Valid operations credentials required.');
    }

    return true;
  }

  private matches(supplied: string, expected: string): boolean {
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);

    return (
      suppliedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(suppliedBuffer, expectedBuffer)
    );
  }
}

@Injectable()
export class MetricsOperationsGuard extends OperationsGuard {
  protected enabled(): boolean {
    return env.METRICS_ENABLED;
  }
}

@Injectable()
export class DiagnosticsOperationsGuard extends OperationsGuard {
  protected enabled(): boolean {
    return env.DETAILED_DIAGNOSTICS_ENABLED;
  }
}
