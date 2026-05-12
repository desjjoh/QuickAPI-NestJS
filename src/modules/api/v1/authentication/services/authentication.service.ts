// src/modules/auth/services/auth.service.ts

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import {
  RegisterDto,
  RegisterMapper,
  RegistrationPendingDto,
} from '../models/register.model';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';

@Injectable()
export class AuthService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly emailSvc: EmailVerificationService,
  ) {}

  public async register(dto: RegisterDto): Promise<RegistrationPendingDto> {
    const password: string = await this.userSvc.hashPassword(dto.password);

    const user = await this.userSvc.createUser(
      RegisterMapper.toCreateUserInput(dto, password),
    );

    await this.emailSvc.sendVerificationEmail(user);

    return new RegistrationPendingDto({
      message: 'Account created. Please verify your email address.',
      email: user.identity.email,
    });
  }

  public async signIn(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.refreshSvc.issueTokens(user, res);
  }

  public async verify(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.refreshSvc.issueTokens(user, res);
  }

  public async signOut(user: UserEntity, res: Response): Promise<void> {
    await this.refreshSvc.revokeTokens(user, res);
  }
}
