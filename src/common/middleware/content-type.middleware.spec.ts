import { contentTypeMiddleware } from './content-type.middleware';

describe('contentTypeMiddleware', () => {
  it('passes GET without content-type', () => {
    const next = jest.fn();
    contentTypeMiddleware({})(
      { method: 'GET', headers: {}, path: '/' } as never,
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('fails POST with missing content-type', () => {
    const mw = contentTypeMiddleware({});
    expect(() =>
      mw(
        { method: 'POST', headers: {}, path: '/' } as never,
        {} as never,
        jest.fn(),
      ),
    ).toThrow('Missing Content-Type header');
  });
});
