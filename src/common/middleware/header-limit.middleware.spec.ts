import { headerLimitsMiddleware } from './header-limit.middleware';

describe('headerLimitsMiddleware', () => {
  it('passes with small headers', () => {
    const next = jest.fn();
    headerLimitsMiddleware({
      maxHeaderCount: 10,
      maxSingleHeaderBytes: 100,
      maxTotalHeaderBytes: 200,
      allowChunked: false,
    })({ headers: { host: 'a' } } as never, {} as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('fails with chunked transfer encoding', () => {
    const mw = headerLimitsMiddleware({
      maxHeaderCount: 10,
      maxSingleHeaderBytes: 100,
      maxTotalHeaderBytes: 200,
      allowChunked: false,
    });
    expect(() =>
      mw(
        { headers: { 'transfer-encoding': 'chunked' } } as never,
        {} as never,
        jest.fn(),
      ),
    ).toThrow('Chunked');
  });
});
