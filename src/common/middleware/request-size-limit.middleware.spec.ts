import { bodyLimitMiddleware } from './request-size-limit.middleware';

describe('bodyLimitMiddleware', () => {
  it('passes non-json requests through', () => {
    const mw = bodyLimitMiddleware({ defaultLimit: 10 });
    const next = jest.fn();
    mw(
      { headers: {}, on: jest.fn(), path: '/' } as never,
      { setHeader: jest.fn() } as never,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('fails immediately when declared content-length exceeds limit', () => {
    const mw = bodyLimitMiddleware({ defaultLimit: 5 });
    const next = jest.fn();
    const res = { setHeader: jest.fn() } as never;

    mw(
      {
        headers: {
          'content-type': 'application/json',
          'content-length': '100',
        },
        on: jest.fn(),
        path: '/',
      } as never,
      res,
      next,
    );

    expect(next.mock.calls[0][0].message).toContain('exceeds limit');
  });
});
