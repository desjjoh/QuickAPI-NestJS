import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { IdentityService } from '@/modules/domain/identity/services/identity.service';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

@Injectable()
class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private service: IdentityService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<UserEntity> {
    return this.service.validateUser(email, password);
  }
}

export { LocalStrategy };
