import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequestContext } from '../store/request-context.store';

@Injectable()
class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  constructor(private readonly requestContext: RequestContext) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await super.canActivate(context);

    const { request } = context.switchToHttp().getRequest();
    if (request?.sub) this.requestContext.set('userId', request.sub);

    return result as boolean;
  }
}

export { RefreshTokenGuard };
