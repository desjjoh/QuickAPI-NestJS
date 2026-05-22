import { methodWhitelistMiddleware } from './method-whitelist.middleware';

describe('methodWhitelistMiddleware', () => {
  it('passes allowed method', () => {
    const next = jest.fn();
    methodWhitelistMiddleware({ allowedMethods: ['GET'] })(
      { method: 'GET' } as never,
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('fails disallowed method', () => {
    const mw = methodWhitelistMiddleware({ allowedMethods: ['GET'] });
    expect(() =>
      mw({ method: 'POST' } as never, {} as never, jest.fn()),
    ).toThrow('not allowed');
  });
});
