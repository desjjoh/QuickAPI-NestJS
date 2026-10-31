import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { defer, firstValueFrom, type Observable } from 'rxjs';
import {
  IDEMPOTENCY_OPERATION,
  SECURITY_OPERATION,
} from '../constants/request-operation.constants';
import { RequestTransactionService } from '@/modules/system/transactions/services/request-transaction.service';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  public constructor(
    private readonly transactions: RequestTransactionService,
    private readonly reflector: Reflector,
  ) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];

    // Specialized request policies own the boundary, regardless of decorator
    // ordering. In particular, replay must claim its key before starting work.
    if (
      this.reflector.getAllAndOverride<string>(
        IDEMPOTENCY_OPERATION,
        targets,
      ) !== undefined ||
      this.reflector.getAllAndOverride<boolean>(SECURITY_OPERATION, targets)
    )
      return next.handle();

    return defer(() =>
      this.transactions.run(() => firstValueFrom(next.handle())),
    );
  }
}
