import { createHash } from 'node:crypto';

const safeCodes = new Set([
  'ER_DUP_ENTRY',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_DATA_TOO_LONG',
  'ER_BAD_NULL_ERROR',
  'ER_NO_REFERENCED_ROW_2',
  'ER_ROW_IS_REFERENCED_2',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENOENT',
  'EACCES',
  'EPERM',
]);
const safeNames = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'AggregateError',
  'QueryFailedError',
  'AbortError',
  'TimeoutError',
]);

/** Allowlist diagnostics; never serialize the exception or provider payload. */
export function errorDiagnostics(
  error: unknown,
): Record<string, string | number> {
  try {
    const value = error as {
      name?: unknown;
      code?: unknown;
      stack?: unknown;
      statusCode?: unknown;
      driverError?: { code?: unknown };
    } | null;
    const name =
      typeof value?.name === 'string' && safeNames.has(value.name)
        ? value.name
        : 'UnknownError';
    const code = value?.driverError?.code ?? value?.code;
    const frames =
      typeof value?.stack === 'string'
        ? value.stack
            .split('\n')
            .filter((line) => /^\s+at\s/.test(line))
            .join('\n')
        : '';
    return {
      errorType: name,
      ...(typeof code === 'string' && safeCodes.has(code)
        ? { errorCode: code }
        : {}),
      ...(typeof value?.statusCode === 'number' &&
      Number.isInteger(value.statusCode) &&
      value.statusCode >= 100 &&
      value.statusCode <= 599
        ? { upstreamStatus: value.statusCode }
        : {}),
      ...(frames
        ? {
            errorFingerprint: createHash('sha256').update(frames).digest('hex'),
          }
        : {}),
    };
  } catch {
    // Even hostile/custom error getters must not break the error boundary.
    return { errorType: 'UnknownError' };
  }
}
