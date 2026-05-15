import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

export interface ValidationPayload {
  userEntity: UserEntity;
  email: string;
  sub: string;
}

@Injectable()
class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private svc: UserService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<ValidationPayload> {
    const user = await this.svc.validateUser(email, password);

    this.svc.assertCanAuthenticate(user);

    return { userEntity: user, email: user.identity.email, sub: user.id };
  }
}

export { LocalStrategy };
