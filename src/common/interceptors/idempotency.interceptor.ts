import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, from, Observable } from 'rxjs';
import type { Request, Response } from 'express';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { requestFingerprint } from '@/common/helpers/request-fingerprint.helper';
import { idempotencyPolicy } from '@/config/idempotency.config';

export const IDEMPOTENCY_OPERATION = 'idempotency:operation';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  public constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['idempotency-key'];
    if (key === undefined) return next.handle();
    if (
      typeof key !== 'string' ||
      !key.length ||
      key.length > idempotencyPolicy.maxKeyLength ||
      !/^[\x21-\x7e]+$/.test(key) ||
      key.includes(',')
    )
      throw new BadRequestException(
        'Idempotency-Key must be one printable, non-whitespace value of at most 128 characters.',
      );
    const actor = (request.user as { userEntity?: { id?: string } } | undefined)
      ?.userEntity?.id;
    if (!actor) throw new UnauthorizedException();
    const response = context.switchToHttp().getResponse<Response>();
    const operation = this.reflector.get<string>(
      IDEMPOTENCY_OPERATION,
      context.getHandler(),
    );
    return from(
      (async () => {
        const fingerprint = await requestFingerprint(request);
        const result = await this.idempotency.execute(
          {
            actorId: actor,
            operation,
            route: `${request.method} ${request.baseUrl}${request.path}`,
          },
          key,
          fingerprint,
          async () => ({
            body: await firstValueFrom(next.handle()),
            status: response.statusCode,
          }),
        );
        response.status(result.status);
        return result.body;
      })(),
    );
  }
}
