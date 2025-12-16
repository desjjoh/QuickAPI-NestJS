import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { BadRequestError } from '@/common/exceptions/http.exception';

const BLOCKLIST = new Set([
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'forwarded',
  'via',
  'client-ip',
  'true-client-ip',
]);

const ALLOWLIST = new Set([
  'host',
  'connection',
  'content-type',
  'content-length',
  'accept',
  'accept-language',
  'accept-encoding',
  'user-agent',
  'referer',
  'origin',
  'cookie',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'authorization',
  'x-csrf-token',
  'x-request-id',
  'x-api-key',
]);

const VALID_NAME_RE: RegExp = /^[A-Za-z0-9-]+$/;
const INVALID_VALUE_CHARS: Set<string> = new Set(['\r', '\n']);

export function sanitizeHeadersMiddleware(): RequestHandler {
  return function sanitizeHeaders(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const seen: Set<string> = new Set<string>();
    const cleaned: Record<string, string | string[]> = {};

    for (const [name, rawValue] of Object.entries(req.headers)) {
      const lower: string = name.toLowerCase();

      // Reject explicitly blocked headers
      if (BLOCKLIST.has(lower)) {
        throw new BadRequestError(`Header '${lower}' is not allowed.`);
      }

      // Reject duplicate headers after normalization
      if (seen.has(lower)) {
        throw new BadRequestError(
          `Duplicate header '${lower}' is not permitted.`,
        );
      }

      seen.add(lower);

      // Reject headers with invalid characters in the name
      if (!VALID_NAME_RE.test(lower)) {
        throw new BadRequestError(
          `Header name '${lower}' contains invalid characters.`,
        );
      }

      const values: string[] = Array.isArray(rawValue)
        ? rawValue
        : [rawValue ?? ''];

      // Reject header values containing prohibited control characters
      for (const v of values) {
        if ([...INVALID_VALUE_CHARS].some((char) => v.includes(char))) {
          throw new BadRequestError(
            `Header value contains prohibited control characters.`,
          );
        }
      }

      // Only allow headers explicitly present in the allowlist
      if (ALLOWLIST.has(lower)) {
        cleaned[lower] = rawValue ?? '';
      }
    }

    req.headers = cleaned;

    return next();
  };
}
