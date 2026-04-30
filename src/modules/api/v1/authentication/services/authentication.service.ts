// src/modules/auth/services/auth.service.ts

import { ConflictException, Injectable } from '@nestjs/common';
import { Response } from 'express';
import { RegisterDto, RegisterMapper } from '../models/register.model';
import { IdentityService } from '@/modules/domain/identity/services/identity.service';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

@Injectable()
export class AuthService {
  public constructor(
    private readonly identityService: IdentityService,
    private readonly userRepository: UserRepository,
  ) {}

  public async register(dto: RegisterDto, res: Response): Promise<JWTDto> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser)
      throw new ConflictException('A user with this email already exists.');

    const password = await this.identityService.hashPassword(dto.password);

    const user = await this.userRepository.createUser(
      RegisterMapper.toCreateUserInput(dto, password),
    );

    return this.identityService.issueTokens(user, res);
  }

  public async signIn(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.identityService.issueTokens(user, res);
  }

  public async verify(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.identityService.issueTokens(user, res);
  }

  public async signOut(user: UserEntity, res: Response): Promise<void> {
    await this.identityService.revokeTokens(user, res);
  }
}
