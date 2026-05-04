import { BadRequestException } from '@nestjs/common';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { RequestBodyTooLargeError } from '@/common/exceptions/http.exception';
import { requestContextRef } from '@/common/store/request-context.store';

export interface BodyLimitOptions {
  defaultLimit: number;
  routeOverrides?: Array<[string, number]>;
}

function isJsonRequest(req: Request): boolean {
  const contentType = req.headers['content-type'];

  if (typeof contentType !== 'string') return false;

  const normalized = contentType.toLowerCase();

  return (
    normalized.includes('application/json') || normalized.includes('+json')
  );
}

function getContentLength(req: Request): number | null {
  const value = req.headers['content-length'];

  if (typeof value !== 'string') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function bodyLimitMiddleware(opts: BodyLimitOptions): RequestHandler {
  const defaultLimit = opts.defaultLimit;
  const routeOverrides = opts.routeOverrides ?? [];

  function selectLimit(path: string): number {
    for (const [prefix, limit] of routeOverrides) {
      if (path.startsWith(prefix)) return limit;
    }

    return defaultLimit;
  }

  return function bodyLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!isJsonRequest(req)) {
      next();
      return;
    }

    const context = requestContextRef?.getStore();

    let completed = false;

    function finish(error?: Error): void {
      if (completed) return;

      completed = true;

      if (context) {
        requestContextRef?.run(context, () => {
          next(error);
        });

        return;
      }

      next(error);
    }

    const limit = selectLimit(req.path);
    const declaredLength = getContentLength(req);

    res.setHeader('X-Body-Limit-Bytes', String(limit));

    if (declaredLength !== null && declaredLength > limit) {
      res.setHeader('X-Body-Actual-Bytes', '0');
      res.setHeader('X-Body-Remaining-Bytes', '0');

      finish(
        new RequestBodyTooLargeError(
          `Request body exceeds limit of ${limit} bytes.`,
        ),
      );

      return;
    }

    let total = 0;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer): void => {
      if (completed) return;

      total += chunk.length;

      if (total > limit) {
        req.pause();

        res.setHeader('X-Body-Actual-Bytes', String(total));
        res.setHeader('X-Body-Remaining-Bytes', '0');

        finish(
          new RequestBodyTooLargeError(
            `Request body exceeds limit of ${limit} bytes.`,
          ),
        );

        return;
      }

      chunks.push(chunk);
    });

    req.on('end', (): void => {
      if (completed) return;

      const buffer = Buffer.concat(chunks);
      const actualLength = buffer.length;
      const remaining = Math.max(limit - actualLength, 0);

      res.setHeader('X-Body-Actual-Bytes', String(actualLength));
      res.setHeader('X-Body-Remaining-Bytes', String(remaining));

      if (declaredLength !== null && declaredLength !== actualLength) {
        finish(
          new BadRequestException(
            `Request body length mismatch. Expected ${declaredLength} bytes but received ${actualLength} bytes.`,
          ),
        );

        return;
      }

      if (actualLength === 0) {
        req.body = {};
        finish();
        return;
      }

      try {
        req.body = JSON.parse(buffer.toString('utf8')) as unknown;
        finish();
      } catch {
        finish(new BadRequestException('Invalid JSON request body.'));
      }
    });

    req.on('error', (error: Error): void => {
      finish(error);
    });

    req.on('aborted', (): void => {
      finish(new BadRequestException('Request body was aborted.'));
    });
  };
}
