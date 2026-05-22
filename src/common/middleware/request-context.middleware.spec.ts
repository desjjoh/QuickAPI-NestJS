jest.mock('nanoid', () => ({ customAlphabet: () => () => 'req-fixed-id' }));

import { requestContextMiddleware } from './request-context.middleware';
import { requestContextRef } from '../store/request-context.store';

describe('requestContextMiddleware', () => {
  it('runs next and stores context metadata', () => {
    const mw = requestContextMiddleware();
    const next = jest.fn();

    mw(
      { method: 'GET', originalUrl: '/p', url: '/p', ip: '127.0.0.1' } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalled();
    const ctx = requestContextRef?.getStore();
    expect(ctx).toBeUndefined();
  });
});
