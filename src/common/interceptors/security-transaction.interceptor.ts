import { isUserDeleted } from '@/modules/domain/identity/policies/user-deletion.policy';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { firstValueFrom, from, Observable } from 'rxjs';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

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
          const result = await this.users.transaction(async (manager) => {
            const actor = (
              request.user as { userEntity?: UserEntity } | undefined
            )?.userEntity;

            if (actor) {
              const current = await manager.findOneOrFail(UserEntity, {
                where: { id: actor.id },
                lock: { mode: 'pessimistic_write' },
              });

              if (isUserDeleted(current))
                throw new UnauthorizedException(
                  'Account is no longer available.',
                );
              (request.user as { userEntity: UserEntity }).userEntity = current;
            }

            return firstValueFrom(next.handle());
          });

          response.cookie = cookie;
          response.clearCookie = clearCookie;
          // A timeout can already have completed the HTTP response while the
          // transaction drains. Never append credentials to a finished socket.
          if (!response.headersSent && !response.destroyed)
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
