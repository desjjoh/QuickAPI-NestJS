import type { Response } from 'express';

import {
  getCsrfCookieName,
  getCsrfCookieOptions,
} from '@/config/cookie.config';
import { env } from '@/config/environment.config';
import { minute } from '@/common/constants/milliseconds.constants';
import { TokenService } from '@/modules/system/tokens/services/token.service';

import { SecurityApiService } from './security.service';

describe('SecurityApiService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns csrf issued and expiry times as unix seconds matching configured cookie max age', async () => {
    const now = 1_714_490_000_123;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const tokenSvc = {
      createCsrfToken: jest.fn().mockReturnValue({
        secret: 'csrf-secret',
        token: 'csrf-token',
      }),
    } as unknown as TokenService;

    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    const svc = new SecurityApiService(tokenSvc);

    const dto = await svc.issueCsrf(res);

    const expectedIat = Math.floor(now / 1000);
    const expectedExp = Math.floor(
      (now + env.CSRF_COOKIE_MAX_AGE_MINUTES * minute) / 1000,
    );

    expect(dto).toEqual({
      token: 'csrf-token',
      iat: expectedIat,
      exp: expectedExp,
    });
    expect(dto.exp - dto.iat).toBe(env.CSRF_COOKIE_MAX_AGE_MINUTES * 60);
    expect(res.cookie).toHaveBeenCalledWith(
      getCsrfCookieName(),
      'csrf-secret',
      getCsrfCookieOptions(),
    );
  });
});
