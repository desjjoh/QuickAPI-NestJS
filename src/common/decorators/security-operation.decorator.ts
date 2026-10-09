import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { ApiBadRequestResponse, ApiExtension } from '@nestjs/swagger';
import { SecurityTransactionInterceptor } from '../interceptors/security-transaction.interceptor';

export const SecurityOperation = () =>
  applyDecorators(
    UseInterceptors(SecurityTransactionInterceptor),
    ApiExtension(
      'x-replay-policy',
      'Idempotency-Key rejected; no-store credential responses; single-use challenges; cookies after commit; rollback permits retry; ambiguous committed credential responses require a fresh authentication flow',
    ),
    ApiBadRequestResponse({
      description:
        'Idempotency-Key is unsupported on security operations; authentication secrets and cookies are never cached for replay.',
    }),
  );
