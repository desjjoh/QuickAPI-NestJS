import { Injectable } from '@nestjs/common';
import { Response } from 'express';

import {
  getCsrfCookieName,
  getCsrfCookieOptions,
} from '@/config/cookie.config';

import { env } from '@/config/environment.config';
import { minute } from '@/common/constants/milliseconds.constants';

import { TokenService } from '@/modules/system/tokens/services/token.service';
import { CsrfDto } from '../models/csrf.model';

@Injectable()
export class SecurityApiService {
  constructor(private readonly tokenSvc: TokenService) {}

  public async issueCsrf(res: Response) {
    const { secret, token } = this.tokenSvc.createCsrfToken();

    const issuedAt = Date.now();
    const csrfMaxAge = env.CSRF_COOKIE_MAX_AGE_MINUTES * minute;
    const iat = Math.floor(issuedAt / 1000);
    const exp = Math.floor((issuedAt + csrfMaxAge) / 1000);

    res.cookie(getCsrfCookieName(), secret, getCsrfCookieOptions());

    return new CsrfDto({
      token,
      iat,
      exp,
    });
  }
}
