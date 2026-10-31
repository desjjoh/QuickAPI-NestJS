import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { ApiConflictResponse, ApiHeader } from '@nestjs/swagger';
import {
  IdempotencyInterceptor,
  IDEMPOTENCY_OPERATION,
  IDEMPOTENCY_SCOPE,
} from '../interceptors/idempotency.interceptor';
import type { IdempotencyCallerScope } from '@/modules/system/idempotency/types/idempotency.types';

/** Apply above multipart interceptors so parsing runs before fingerprinting. */
export function Idempotent(
  operation: string,
  options: { scope?: IdempotencyCallerScope } = {},
) {
  const scope = options.scope ?? 'user';

  return applyDecorators(
    SetMetadata(IDEMPOTENCY_OPERATION, operation),
    SetMetadata(IDEMPOTENCY_SCOPE, scope),
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: `Optional request key: 1–128 printable ASCII characters, excluding whitespace and commas. Scoped to ${scope === 'public' ? 'the shared public namespace' : 'the authenticated user'}, operation and route. Identical completed retries replay the original JSON/status for 24 hours (204 has no body); current route authorization is still required. Different payloads or an in-progress request return 409. Omit on credential/token/cookie endpoints.`,
    }),
    ApiConflictResponse({
      description:
        'Conflicting key payload, another request using this key is still processing, or a stale expected_version on endpoints with optimistic concurrency.',
    }),
  );
}
