import { createHmac } from 'node:crypto';

import { env } from '@/config/environment.config';

/** Produces a non-reversible, deployment-keyed lookup value for audit records. */
export function hashAuditIdentifier(identifier: string): string {
  return createHmac('sha256', env.CRYPTO_SECRET)
    .update(identifier.trim().toLowerCase())
    .digest('hex');
}
