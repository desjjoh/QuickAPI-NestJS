import type { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger.config';

export function outgoingLogger() {
  return function (req: Request, res: Response, next: NextFunction): void {
    const start: number = performance.now();

    function shortenPath(path: string, max = 20): string {
      return path.length > max ? path.slice(0, max - 1) + '…' : path;
    }

    res.on('finish', () => {
      const duration = (performance.now() - start).toFixed(2);

      const method = req.method;
      const path = req.originalUrl ?? req.url;

      const code = res.statusCode;

      const level: 'error' | 'warn' | 'info' =
        code >= 500 ? 'error' : code >= 400 ? 'warn' : 'info';

      const pathPadded: string = shortenPath(path, 30).padEnd(32);
      const status: string = String(code).padEnd(3, ' ');
      const methodPadded: string = method.padEnd(7, ' ');

      logger[level](`${status} ${methodPadded} ${pathPadded} ${duration}ms`);
    });

    next();
  };
}
