import { Request, Response, NextFunction } from 'express';

import {
  httpRequestCounter,
  httpRequestDuration,
} from '@/config/metrics.config';

export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = performance.now();

  res.on('finish', () => {
    const duration = Number(performance.now() - start);

    const method = req.method;
    const status = res.statusCode.toString();
    const route = req.route?.path ?? req.originalUrl ?? 'unknown';

    httpRequestCounter.inc({
      method,
      route,
      status,
    });

    httpRequestDuration.observe(
      {
        method,
        route,
        status,
      },
      duration,
    );
  });

  next();
}
