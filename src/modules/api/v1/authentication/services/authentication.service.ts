// src/modules/auth/services/auth.service.ts

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { RegisterDto, RegisterMapper } from '../models/register.model';
import { IdentityService } from '@/modules/domain/identity/services/identity.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

@Injectable()
export class AuthService {
  public constructor(private readonly identitySvc: IdentityService) {}

  public async register(dto: RegisterDto, res: Response): Promise<JWTDto> {
    const password: string = await this.identitySvc.hashPassword(dto.password);
    const user: UserEntity = await this.identitySvc.createUser(
      RegisterMapper.toCreateUserInput(dto, password),
    );

    return this.identitySvc.issueTokens(user, res);
  }

  public async signIn(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.identitySvc.issueTokens(user, res);
  }

  public async verify(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.identitySvc.issueTokens(user, res);
  }

  public async signOut(user: UserEntity, res: Response): Promise<void> {
    await this.identitySvc.revokeTokens(user, res);
  }
}
