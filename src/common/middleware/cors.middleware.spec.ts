import { corsMiddleware } from './cors.middleware';

describe('corsMiddleware', () => {
  const opts = {
    origin: ['http://ok'],
    methods: ['GET'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['Content-Type'],
  };

  it('passes allowed origin', () => {
    const next = jest.fn();
    const res = { setHeader: jest.fn() } as never;
    corsMiddleware(opts)(
      { headers: { origin: 'http://ok' }, method: 'GET' } as never,
      res,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('fails disallowed origin', () => {
    expect(() =>
      corsMiddleware(opts)(
        { headers: { origin: 'http://bad' }, method: 'GET' } as never,
        { setHeader: jest.fn() } as never,
        jest.fn(),
      ),
    ).toThrow('not allowed');
  });
});
