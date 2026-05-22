import type { ExecutionContext } from '@nestjs/common';

import { getCsrfCookieName } from '@/config/cookie.config';
import { TokenService } from '@/modules/system/tokens/services/token.service';

import { CsrfGuard } from './csrf.guard';

type MockRequest = {
  headers: Record<string, unknown>;
  cookies?: Record<string, unknown>;
};

type TokenServiceMock = jest.Mocked<Pick<TokenService, 'verifyCsrfToken'>>;

function createExecutionContext(req: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

function createTokenServiceMock(): TokenServiceMock {
  return {
    verifyCsrfToken: jest.fn(),
  };
}

function asTokenService(service: TokenServiceMock): TokenService {
  return service as unknown as TokenService;
}

describe('CsrfGuard', () => {
  it('allows request when header token, cookie secret, and verification are valid', () => {
    const tokenSvc = createTokenServiceMock();
    tokenSvc.verifyCsrfToken.mockReturnValue(true);

    const guard = new CsrfGuard(asTokenService(tokenSvc));

    const req = {
      headers: {
        'x-csrf-token': 'csrf-token',
      },
      cookies: {
        [getCsrfCookieName()]: 'csrf-secret',
      },
    };

    const result = guard.canActivate(createExecutionContext(req));

    expect(result).toBe(true);
    expect(tokenSvc.verifyCsrfToken).toHaveBeenCalledWith(
      'csrf-secret',
      'csrf-token',
    );
  });

  it('denies request when csrf header is missing', () => {
    const tokenSvc = createTokenServiceMock();
    const guard = new CsrfGuard(asTokenService(tokenSvc));

    const req = {
      headers: {},
      cookies: {
        [getCsrfCookieName()]: 'csrf-secret',
      },
    };

    const result = guard.canActivate(createExecutionContext(req));

    expect(result).toBe(false);
    expect(tokenSvc.verifyCsrfToken).not.toHaveBeenCalled();
  });

  it('denies request when csrf cookie is missing', () => {
    const tokenSvc = createTokenServiceMock();
    const guard = new CsrfGuard(asTokenService(tokenSvc));

    const req = {
      headers: {
        'x-csrf-token': 'csrf-token',
      },
      cookies: {},
    };

    const result = guard.canActivate(createExecutionContext(req));

    expect(result).toBe(false);
    expect(tokenSvc.verifyCsrfToken).not.toHaveBeenCalled();
  });

  it('denies request when cookies object is missing', () => {
    const tokenSvc = createTokenServiceMock();
    const guard = new CsrfGuard(asTokenService(tokenSvc));

    const req = {
      headers: {
        'x-csrf-token': 'csrf-token',
      },
    };

    const result = guard.canActivate(createExecutionContext(req));

    expect(result).toBe(false);
    expect(tokenSvc.verifyCsrfToken).not.toHaveBeenCalled();
  });

  it('denies request when csrf header is not a string', () => {
    const tokenSvc = createTokenServiceMock();
    const guard = new CsrfGuard(asTokenService(tokenSvc));

    const req = {
      headers: {
        'x-csrf-token': ['csrf-token'],
      },
      cookies: {
        [getCsrfCookieName()]: 'csrf-secret',
      },
    };

    const result = guard.canActivate(createExecutionContext(req));

    expect(result).toBe(false);
    expect(tokenSvc.verifyCsrfToken).not.toHaveBeenCalled();
  });

  it('denies request when csrf cookie is not a string', () => {
    const tokenSvc = createTokenServiceMock();
    const guard = new CsrfGuard(asTokenService(tokenSvc));

    const req = {
      headers: {
        'x-csrf-token': 'csrf-token',
      },
      cookies: {
        [getCsrfCookieName()]: ['csrf-secret'],
      },
    };

    const result = guard.canActivate(createExecutionContext(req));

    expect(result).toBe(false);
    expect(tokenSvc.verifyCsrfToken).not.toHaveBeenCalled();
  });

  it('denies request when token service verification fails', () => {
    const tokenSvc = createTokenServiceMock();
    tokenSvc.verifyCsrfToken.mockReturnValue(false);

    const guard = new CsrfGuard(asTokenService(tokenSvc));

    const req = {
      headers: {
        'x-csrf-token': 'csrf-token',
      },
      cookies: {
        [getCsrfCookieName()]: 'csrf-secret',
      },
    };

    const result = guard.canActivate(createExecutionContext(req));

    expect(result).toBe(false);
    expect(tokenSvc.verifyCsrfToken).toHaveBeenCalledWith(
      'csrf-secret',
      'csrf-token',
    );
  });
});
