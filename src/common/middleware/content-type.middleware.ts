export const CONTENT_TYPE_OPTIONS = Symbol('CONTENT_TYPE_OPTIONS');

export interface RouteOverride {
  prefix: string;
  allowed: string[];
}

export interface ContentTypeOptions {
  defaultAllowed?: string[];
  routeOverrides?: RouteOverride[];
}

import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { UnsupportedMediaTypeError } from '@/common/exceptions/http.exception';

const NO_BODY_METHODS = new Set(['GET', 'DELETE', 'HEAD', 'OPTIONS']);

@Injectable()
export class ContentTypeMiddleware implements NestMiddleware {
  private readonly routeOverrides: RouteOverride[];
  private readonly defaultAllowed: Set<string>;

  constructor(
    @Inject(CONTENT_TYPE_OPTIONS)
    private readonly opts: ContentTypeOptions,
  ) {
    this.routeOverrides = this.opts.routeOverrides ?? [];
    this.defaultAllowed = new Set(
      this.opts.defaultAllowed ?? ['application/json'],
    );
  }

  private getAllowedFor(path: string): Set<string> {
    for (const { prefix, allowed } of this.routeOverrides) {
      if (path.startsWith(prefix)) {
        return new Set(allowed.map((t) => t.toLowerCase()));
      }
    }

    return new Set([...this.defaultAllowed].map((t) => t.toLowerCase()));
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    const contentType = req.headers['content-type'];

    // -- Methods that must NOT send a body
    if (NO_BODY_METHODS.has(method)) {
      if (contentType !== undefined) {
        throw new UnsupportedMediaTypeError(
          `HTTP method '${method}' does not accept a request body.`,
        );
      }

      return next();
    }

    // -- Methods that MUST validate content-type
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const allowed = this.getAllowedFor(req.path);

      if (!contentType) {
        throw new UnsupportedMediaTypeError('Missing Content-Type header.');
      }

      const normalized = contentType.split(';')[0].trim().toLowerCase();

      if (!allowed.has(normalized)) {
        const expected = Array.from(allowed).sort();
        throw new UnsupportedMediaTypeError(
          `Content-Type '${contentType}' is not allowed on this endpoint. Expected one of: ${expected}.`,
        );
      }
    }

    next();
  }
}
