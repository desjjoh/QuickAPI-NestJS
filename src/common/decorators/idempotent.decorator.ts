import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { ApiConflictResponse, ApiHeader } from '@nestjs/swagger';
import {
  IdempotencyInterceptor,
  IDEMPOTENCY_OPERATION,
} from '../interceptors/idempotency.interceptor';

/** Apply above multipart interceptors so parsing runs before fingerprinting. */
export function Idempotent(operation: string) {
  return applyDecorators(
    SetMetadata(IDEMPOTENCY_OPERATION, operation),
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description:
        'Optional unique request key (1–128 printable characters). Identical completed retries replay the original response for 24 hours. Different payloads or an in-progress request return 409.',
    }),
    ApiConflictResponse({
      description:
        'Stale expected_version, conflicting key payload, or another request using this key is still processing.',
    }),
  );
}
