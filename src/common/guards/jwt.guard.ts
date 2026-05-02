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

    const { user } = context.switchToHttp().getRequest();

    this.requestContext.set('userId', user.sub);

    return result as boolean;
  }
}

export { JwtAuthGuard };
