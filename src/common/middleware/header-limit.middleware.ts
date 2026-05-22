import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { IncomingHttpHeaders } from 'http';

import {
  RequestHeaderFieldsTooLargeError,
  UnsupportedTransferEncodingError,
} from '@/common/exceptions/http.exception';

export interface HeaderLimits {
  maxHeaderCount: number;
  maxSingleHeaderBytes: number;
  maxTotalHeaderBytes: number;
  allowChunked: boolean;
}

const defaultLimits: HeaderLimits = {
  maxHeaderCount: 100,
  maxSingleHeaderBytes: 4_096,
  maxTotalHeaderBytes: 8_192,
  allowChunked: false,
};

export function headerLimitsMiddleware(
  limits: HeaderLimits = defaultLimits,
): RequestHandler {
  return function headerLimits(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const headers: IncomingHttpHeaders = req.headers;
    const headerEntries: [string, string | string[] | undefined][] =
      Object.entries(headers);

    if (headerEntries.length > limits.maxHeaderCount) {
      throw new RequestHeaderFieldsTooLargeError(
        `Too many headers (limit = ${limits.maxHeaderCount}).`,
      );
    }

    let totalBytes = 0;

    for (const [key, value] of headerEntries) {
      const keyBytes: number = Buffer.byteLength(key);
      const values: string[] = Array.isArray(value) ? value : [value ?? ''];

      for (const v of values) {
        const valueBytes: number = Buffer.byteLength(v);
        const size: number = keyBytes + valueBytes;

        totalBytes += size;

        if (size > limits.maxSingleHeaderBytes) {
          throw new RequestHeaderFieldsTooLargeError(
            `Header exceeds per-header size limit (${limits.maxSingleHeaderBytes} bytes).`,
          );
        }
      }
    }

    if (totalBytes > limits.maxTotalHeaderBytes) {
      throw new RequestHeaderFieldsTooLargeError(
        `Total header size exceeds limit (${limits.maxTotalHeaderBytes} bytes).`,
      );
    }

    const transferEncoding: string | string[] | undefined =
      req.headers['transfer-encoding'];

    const transferEncodingValues: string[] = Array.isArray(transferEncoding)
      ? transferEncoding
      : [transferEncoding ?? ''];

    if (!limits.allowChunked) {
      const hasChunked = transferEncodingValues.some((value) =>
        value.toLowerCase().includes('chunked'),
      );

      if (hasChunked) {
        throw new UnsupportedTransferEncodingError(
          'Chunked request bodies are not allowed.',
        );
      }
    }

    next();
  };
}
