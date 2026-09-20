import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequestContext } from '../store/request-context.store';
import { AuditActorType, AuditSource } from '@/config/audit-events.config';

@Injectable()
class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  constructor(private readonly requestContext: RequestContext) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await super.canActivate(context);

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (user?.sub) this.requestContext.set('actorId', user.sub);

    this.requestContext.set('actorType', AuditActorType.USER);
    this.requestContext.set('source', AuditSource.HTTP);

    const sessionId = user?.sessionEntity?.id ?? user?.sid ?? user?.sessionId;

    if (typeof sessionId === 'string')
      this.requestContext.set('sessionId', sessionId);

    return result as boolean;
  }
}

export { RefreshTokenGuard };
