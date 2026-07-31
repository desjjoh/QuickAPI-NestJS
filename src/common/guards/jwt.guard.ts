import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { RequestContext } from '../store/request-context.store';

@Injectable()
class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(private readonly requestContext: RequestContext) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await super.canActivate(context);

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    this.requestContext.set('actorId', user.sub);
    this.requestContext.set('actorType', 'user');
    this.requestContext.set('source', 'http');

    const sessionId = user.sessionEntity?.id ?? user.sid ?? user.sessionId;

    if (typeof sessionId === 'string')
      this.requestContext.set('sessionId', sessionId);

    const normalizedRoute = request.route?.path;

    if (typeof normalizedRoute === 'string')
      this.requestContext.set(
        'normalizedRoute',
        `${request.baseUrl ?? ''}${normalizedRoute}`,
      );

    return result as boolean;
  }
}

export { JwtAuthGuard };
