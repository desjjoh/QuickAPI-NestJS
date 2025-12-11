import type { Request, Response, NextFunction } from 'express';

import { Inject, Injectable, NestMiddleware } from '@nestjs/common';

import {
  RequestHeaderFieldsTooLargeError,
  UnsupportedTransferEncodingError,
} from '@/common/exceptions/http.exception';

export const HEADER_LIMITS_TOKEN = Symbol('HEADER_LIMITS_TOKEN');

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

@Injectable()
export class HeaderLimitsMiddleware implements NestMiddleware {
  constructor(
    @Inject(HEADER_LIMITS_TOKEN)
    private readonly limits: HeaderLimits = defaultLimits,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const headers = req.headers;
    const headerEntries = Object.entries(headers);

    // --- Too many header fields ---
    if (headerEntries.length > this.limits.maxHeaderCount) {
      throw new RequestHeaderFieldsTooLargeError(
        `Too many headers (limit = ${this.limits.maxHeaderCount}).`,
      );
    }

    let totalBytes = 0;

    // --- Per-header and total size enforcement ---
    for (const [key, value] of headerEntries) {
      const keyBytes = Buffer.byteLength(key);
      const values: string[] = Array.isArray(value) ? value : [value ?? ''];

      for (const v of values) {
        const valueBytes = Buffer.byteLength(v);
        const size = keyBytes + valueBytes;

        totalBytes += size;

        if (size > this.limits.maxSingleHeaderBytes) {
          throw new RequestHeaderFieldsTooLargeError(
            `Header exceeds per-header size limit (${this.limits.maxSingleHeaderBytes} bytes).`,
          );
        }
      }
    }

    if (totalBytes > this.limits.maxTotalHeaderBytes) {
      throw new RequestHeaderFieldsTooLargeError(
        `Total header size exceeds limit (${this.limits.maxTotalHeaderBytes} bytes).`,
      );
    }

    // --- Prevent chunked transfer encoding ---
    const transferEncoding = req.headers['transfer-encoding'];

    if (!this.limits.allowChunked && typeof transferEncoding === 'string') {
      if (transferEncoding.toLowerCase().includes('chunked')) {
        throw new UnsupportedTransferEncodingError(
          'Chunked request bodies are not allowed.',
        );
      }
    }

    next();
  }
}
