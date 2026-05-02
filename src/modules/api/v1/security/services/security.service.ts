import { Injectable } from '@nestjs/common';
import { Response } from 'express';

import { hour } from '@/common/constants/milliseconds.constants';
import { TokenService } from '@/modules/system/tokens/services/token.service';
import { CsrfDto } from '../models/csrf.model';

@Injectable()
export class SecurityApiService {
  constructor(private readonly tokenService: TokenService) {}

  public async issueCsrf(res: Response) {
    const { secret, token } = this.tokenService.createCsrfToken();

    const iat = Date.now();
    const exp = iat + 1 * hour;

    res.cookie('csrf_secret', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return new CsrfDto({
      token,
      iat,
      exp,
    });
  }
}
