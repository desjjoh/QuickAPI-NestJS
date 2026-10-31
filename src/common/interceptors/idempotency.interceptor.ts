import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, from, Observable } from 'rxjs';
import type { Request, Response } from 'express';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { requestFingerprint } from '@/common/helpers/request-fingerprint.helper';
import { idempotencyPolicy } from '@/config/idempotency.config';
import { idempotencyActorId } from '@/modules/system/idempotency/helpers/idempotency-scope.helper';
import type { IdempotencyCallerScope } from '@/modules/system/idempotency/types/idempotency.types';
import { RequestTransactionService } from '@/modules/system/transactions/services/request-transaction.service';
import {
  IDEMPOTENCY_OPERATION,
  IDEMPOTENCY_SCOPE,
} from '../constants/request-operation.constants';

export {
  IDEMPOTENCY_OPERATION,
  IDEMPOTENCY_SCOPE,
} from '../constants/request-operation.constants';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  public constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
    private readonly transactions: RequestTransactionService,
  ) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const callerScope =
      this.reflector.get<IdempotencyCallerScope>(
        IDEMPOTENCY_SCOPE,
        context.getHandler(),
      ) ?? 'user';
    const actor = idempotencyActorId(
      callerScope,
      (request.user as { userEntity?: { id?: unknown } } | undefined)
        ?.userEntity?.id,
    );
    const key = request.headers['idempotency-key'];

    if (key === undefined)
      return from(this.transactions.run(() => firstValueFrom(next.handle())));
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
            ...(actor === null
              ? { callerScope: 'public' as const }
              : { actorId: actor }),
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

        return result.status === 204 ? undefined : result.body;
      })(),
    );
  }
}
