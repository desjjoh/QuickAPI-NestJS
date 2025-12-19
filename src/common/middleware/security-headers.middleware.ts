import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function securityHeadersMiddleware(): RequestHandler {
  return function securityHeaders(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    // Remove framework-identifying header
    res.removeHeader('X-Powered-By');

    const path: string = req.originalUrl ?? req.url;

    if (path.startsWith('/docs') || path.startsWith('/openapi.json'))
      return next();

    // Core security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');

    // HSTS (enable only when HTTPS is guaranteed)
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );

    // Cross-origin isolation headers
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Permissions policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );

    // Content Security Policy (matches FastAPI exactly)
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
      ].join('; '),
    );

    next();
  };
}
