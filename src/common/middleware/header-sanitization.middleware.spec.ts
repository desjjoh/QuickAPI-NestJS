import { sanitizeHeadersMiddleware } from './header-sanitization.middleware';

describe('sanitizeHeadersMiddleware', () => {
  it('keeps allowlisted headers and removes unknown', () => {
    const mw = sanitizeHeadersMiddleware();
    const req = {
      headers: {
        host: 'api.local',
        authorization: 'Bearer abc',
        'x-foo': 'bar',
      },
    } as never;
    const next = jest.fn();

    mw(req, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect(
      (req as never as { headers: Record<string, string> }).headers,
    ).toEqual({
      host: 'api.local',
      authorization: 'Bearer abc',
    });
  });

  it('rejects control characters in values', () => {
    const mw = sanitizeHeadersMiddleware();
    expect(() =>
      mw(
        { headers: { host: 'ok', authorization: 'bad\nvalue' } } as never,
        {} as never,
        jest.fn(),
      ),
    ).toThrow('prohibited control characters');
  });
});
