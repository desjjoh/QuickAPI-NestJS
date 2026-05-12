import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

@Injectable()
class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private svc: UserService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<UserEntity> {
    const user = await this.svc.validateUser(email, password);

    this.svc.assertCanAuthenticate(user);

    return user;
  }
}

export { LocalStrategy };
