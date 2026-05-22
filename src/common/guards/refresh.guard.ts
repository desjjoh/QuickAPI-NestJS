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

    const { user } = context.switchToHttp().getRequest();
    if (user?.sub) this.requestContext.set('userId', user.sub);

    return result as boolean;
  }
}

export { RefreshTokenGuard };
