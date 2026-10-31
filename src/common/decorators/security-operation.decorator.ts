import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { ApiBadRequestResponse, ApiExtension } from '@nestjs/swagger';
import { SecurityTransactionInterceptor } from '../interceptors/security-transaction.interceptor';
import { SECURITY_OPERATION } from '../constants/request-operation.constants';
import { Transactional } from './transactional.decorator';

export const SecurityOperation = () =>
  applyDecorators(
    SetMetadata(SECURITY_OPERATION, true),
    Transactional(),
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
