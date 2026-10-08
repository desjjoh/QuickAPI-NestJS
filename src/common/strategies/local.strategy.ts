import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserCredentialsService } from '@/modules/domain/identity/services/user-credentials.service';
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
  constructor(private readonly credentials: UserCredentialsService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<ValidationPayload> {
    const user = await this.credentials.validateUser(email, password);
    this.credentials.assertCanAuthenticate(user);

    return { userEntity: user, email: user.identity.email, sub: user.id };
  }
}

export { LocalStrategy };
