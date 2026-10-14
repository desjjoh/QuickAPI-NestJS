import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/config/logger.config';
import { outgoingLogger } from '@/common/middleware/logger.middleware';

describe('request summary privacy', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([true, false])(
    'logs templates, never personal paths or query tokens (matched=%s)',
    (matched) => {
      const log = jest
        .spyOn(logger, 'error')
        .mockImplementation(() => undefined);
      const req = {
        method: 'GET',
        originalUrl: '/users/private@example.test?token=super-secret',
        url: '/users/private@example.test?token=super-secret',
        ...(matched ? { route: { path: '/users/:id' } } : {}),
      } as unknown as Request;
      const res = Object.assign(new EventEmitter(), { statusCode: 500 });
      outgoingLogger()(
        req,
        res as unknown as Response,
        jest.fn() as NextFunction,
      );
      res.emit('finish');
      const output = JSON.stringify(log.mock.calls);
      expect(output).toContain(matched ? '/users/:id' : '<unmatched>');
      expect(output).not.toMatch(/private@|super-secret|token=/);
    },
  );
});
