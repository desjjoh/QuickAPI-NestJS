import { UnauthorizedException } from '@nestjs/common';
import { InvalidOperationError } from '@/common/errors/operation.error';
import type { IdempotencyCallerScope } from '../types/idempotency.types';

/** Missing identity must never turn a user-scoped operation into a public one. */
export function idempotencyActorId(
  scope: IdempotencyCallerScope,
  actorId: unknown,
): string | null {
  if (scope === 'public') return null;

  if (scope !== 'user')
    throw new InvalidOperationError('Unsupported idempotency caller scope.');

  if (typeof actorId !== 'string' || !actorId.trim())
    throw new UnauthorizedException(
      'An authenticated user ID is required for user-scoped idempotency.',
    );

  return actorId;
}
