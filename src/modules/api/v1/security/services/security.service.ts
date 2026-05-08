import { Injectable } from '@nestjs/common';
import { Response } from 'express';

import {
  getCsrfCookieName,
  getCsrfCookieOptions,
} from '@/config/cookie.config';

import { hour } from '@/common/constants/milliseconds.constants';
import { TokenService } from '@/modules/system/tokens/services/token.service';
import { CsrfDto } from '../models/csrf.model';

@Injectable()
export class SecurityApiService {
  constructor(private readonly tokenSvc: TokenService) {}

  public async issueCsrf(res: Response) {
    const { secret, token } = this.tokenSvc.createCsrfToken();

    const iat = Date.now();
    const exp = iat + 1 * hour;

    res.cookie(getCsrfCookieName(), secret, getCsrfCookieOptions());

    return new CsrfDto({
      token,
      iat,
      exp,
    });
  }
}
