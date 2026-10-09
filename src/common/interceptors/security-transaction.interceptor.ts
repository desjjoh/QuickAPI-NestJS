import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { firstValueFrom, from, Observable } from 'rxjs';
import { UserService } from '@/modules/domain/identity/services/user.service';

/** No credential response replay; stage cookies until every security write commits. */
@Injectable()
export class SecurityTransactionInterceptor implements NestInterceptor {
  public constructor(private readonly users: UserService) {}
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (request.headers['idempotency-key'] !== undefined)
      throw new BadRequestException(
        'Security endpoints do not replay credentials or cookies. Omit Idempotency-Key; consumed challenges require a fresh flow.',
      );
    return from(
      (async () => {
        const cookie = response.cookie;
        const clearCookie = response.clearCookie;
        const cookies: Array<() => void> = [];
        response.cookie = ((...args: Parameters<Response['cookie']>) => {
          cookies.push(() => cookie.apply(response, args));
          return response;
        }) as Response['cookie'];
        response.clearCookie = ((
          ...args: Parameters<Response['clearCookie']>
        ) => {
          cookies.push(() => clearCookie.apply(response, args));
          return response;
        }) as Response['clearCookie'];
        try {
          const result = await this.users.transaction(async () =>
            firstValueFrom(next.handle()),
          );
          response.cookie = cookie;
          response.clearCookie = clearCookie;
          cookies.forEach((apply) => apply());
          return result;
        } finally {
          response.cookie = cookie;
          response.clearCookie = clearCookie;
        }
      })(),
    );
  }
}
