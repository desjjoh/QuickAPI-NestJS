import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export const generateIdentityToken = (): string =>
  randomBytes(32).toString('base64url');

export const generateVerificationCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

export const hashIdentityToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const compareIdentityTokenHashes = (
  expected: string,
  actual: string,
): boolean => {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
};

export const isVerificationCode = (code: string): boolean =>
  /^\d{6}$/.test(code);

export const metadataMatches = (
  metadata: Record<string, unknown> | null,
  expected: Record<string, unknown>,
): boolean =>
  Object.entries(expected).every(([key, value]) => metadata?.[key] === value);
