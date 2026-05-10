import { getCsrfCookieName } from '@/config/cookie.config';
import { TokenService } from '@/modules/system/tokens/services/token.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly svc: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const token = req.headers['x-csrf-token'];
    const secret = req.cookies?.[getCsrfCookieName()];

    if (typeof token !== 'string' || typeof secret !== 'string') return false;

    return this.svc.verifyCsrfToken(secret, token);
  }
}
