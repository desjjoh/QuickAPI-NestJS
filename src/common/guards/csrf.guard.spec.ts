import { getCsrfCookieName } from '@/config/cookie.config';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  it('fails when token/secret missing', () => {
    const guard = new CsrfGuard({ verifyCsrfToken: jest.fn() } as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, cookies: {} }),
      }),
    } as never;
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('passes when service verifies token', () => {
    const guard = new CsrfGuard({
      verifyCsrfToken: jest.fn().mockReturnValue(true),
    } as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-csrf-token': 'a' },
          cookies: { [getCsrfCookieName()]: 'b' },
        }),
      }),
    } as never;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
