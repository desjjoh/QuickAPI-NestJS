import { TokenService } from '@/modules/system/tokens/services/token.service';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const secret = req.cookies?.csrf_secret;
    const token = req.headers['x-csrf-token'];

    if (!secret || !token) throw new ForbiddenException('CSRF token missing.');

    const valid = this.tokenService.verifyCsrfToken(secret, token);

    if (!valid) throw new ForbiddenException('Invalid CSRF token.');

    return true;
  }
}
