import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EntityManager } from 'typeorm';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

import { UserEntity, createUserMetadata } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from './user.service';

@Injectable()
export class UserCredentialsService {
  public constructor(
    private readonly users: UserService,
    private readonly userRepo: UserRepository,
  ) {}

  public async validateUser(
    email: string,
    password: string,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity> {
    const user = await this.users.findByEmail(email, manager);

    if (!user?.identity?.password)
      throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.identity.password);

    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  public canAuthenticate(user: UserEntity): boolean {
    return user.status?.key === ACCOUNT_STATUS_KEYS.ACTIVE;
  }

  public assertCanAuthenticate(user: UserEntity): void {
    if (!this.canAuthenticate(user))
      throw new ForbiddenException('Account is not active.');
  }

  public hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  public recordSignIn(
    user: UserEntity,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity> {
    return this.updateMetadata(user, { last_sign_in: new Date() }, manager);
  }

  public recordEmailChanged(
    user: UserEntity,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity> {
    return this.updateMetadata(
      user,
      { last_changed_email: new Date() },
      manager,
    );
  }

  public recordPasswordChanged(
    user: UserEntity,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity> {
    return this.updateMetadata(
      user,
      { last_changed_password: new Date() },
      manager,
    );
  }

  public recordMfaChanged(
    user: UserEntity,
    enabled: boolean,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity> {
    return this.updateMetadata(
      user,
      { last_changed_mfa: new Date(), mfa_enabled: enabled },
      manager,
    );
  }

  private async updateMetadata(
    user: UserEntity,
    metadata: Partial<UserEntity['metadata']>,
    manager: EntityManager,
  ): Promise<UserEntity> {
    const current = await this.users.findByIdOrFail(user.id, manager);

    return this.users.updateUser(
      current,
      {
        metadata: createUserMetadata({
          ...current.metadata,
          ...metadata,
        }),
      },
      {},
      manager,
    );
  }
}
