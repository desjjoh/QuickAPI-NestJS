import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { DeepPartial } from 'typeorm';

import {
  getClearRefreshCookieOptions,
  getRefreshCookieName,
  getRefreshCookieOptions,
} from '@/config/cookie.config';

import { TokenService } from '@/modules/system/tokens/services/token.service';

import { JWTDto } from '../models/jwt.model';
import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserAddressEntity } from '../entities/address.entity';
import { AccountStatusRepository } from '../../library/repositories/accountstatus.repository';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { AccountStatusEntity } from '../../library/entities/accountstatus.entity';
import {
  DecodedToken,
  TokenPair,
} from '@/modules/system/tokens/types/token.types';

@Injectable()
export class IdentityService {
  public constructor(
    private readonly tokenSvc: TokenService,
    private readonly userRepo: UserRepository,
    private readonly statusRepo: AccountStatusRepository,
  ) {}

  public async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity> {
    const user: UserEntity | null = await this.userRepo.findByEmail(email);

    if (!user?.identity?.password)
      throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.identity.password);

    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  public hasPermission(user: UserEntity, keys: string[]): void {
    const userPermissions: Set<string> = new Set(
      user.roles?.flatMap(
        (role) => role.permissions?.map((permission) => permission.key) ?? [],
      ) ?? [],
    );

    const hasPermission: boolean = keys.some((key: string) =>
      userPermissions.has(key),
    );

    if (!hasPermission)
      throw new UnauthorizedException('User does not have required permission');
  }

  public assertCanAuthenticate(user: UserEntity): void {
    if (user.status.key === ACCOUNT_STATUS_KEYS.ACTIVE) return;

    throw new ForbiddenException('Account is not active.');
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  public async issueTokens(user: UserEntity, res: Response): Promise<JWTDto> {
    const tokens: TokenPair = await this.tokenSvc.createTokenPair({
      sub: user.id,
      email: user.identity.email,
      version: user.credentials.token_version,
    });

    const hashedRefreshToken: string = this.tokenSvc.hashToken(
      tokens.refresh_token,
    );

    await this.updateRefreshToken(user, hashedRefreshToken);

    const accessToken: DecodedToken = this.tokenSvc.decode(tokens.access_token);
    const refreshToken: DecodedToken = this.tokenSvc.decode(
      tokens.refresh_token,
    );

    res.cookie(
      getRefreshCookieName(),
      tokens.refresh_token,
      getRefreshCookieOptions(),
    );

    return new JWTDto({
      refresh: refreshToken.exp,
      access_token: tokens.access_token,
      iat: accessToken.iat,
      exp: accessToken.exp,
      user,
    });
  }

  public async revokeTokens(user: UserEntity, res: Response): Promise<void> {
    await this.userRepo.incrementTokenVersion(user.id);

    res.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  private async updateRefreshToken(
    user: UserEntity,
    refresh: string,
  ): Promise<UserEntity> {
    const updatedUser: UserEntity = this.userRepo.merge(user, {
      credentials: {
        ...user.credentials,
        refresh,
      },
    });

    return this.userRepo.save(updatedUser);
  }

  public async deleteAddress(address: UserAddressEntity): Promise<void> {
    await this.userRepo.manager.delete(UserAddressEntity, {
      id: address.id,
    });
  }

  public async updateUser(user: UserEntity, dto: DeepPartial<UserEntity>) {
    await this.userRepo.update(user.id, dto);

    return this.userRepo.findByIdOrFail(user.id);
  }

  public async deleteUser(user: UserEntity, res: Response): Promise<void> {
    await this.userRepo.removeUser(user.id);

    res.clearCookie(getRefreshCookieName(), getClearRefreshCookieOptions());
  }

  private async getDefaultAccountStatus(): Promise<AccountStatusEntity> {
    const status: AccountStatusEntity | null = await this.statusRepo.findOne({
      where: { key: ACCOUNT_STATUS_KEYS.ACTIVE },
    });

    if (!status) {
      throw new InternalServerErrorException(
        'Default account status is not seeded.',
      );
    }

    return status;
  }

  public async createUser(input: DeepPartial<UserEntity>): Promise<UserEntity> {
    const email: string | undefined = input.identity?.email;

    if (!email)
      throw new InternalServerErrorException(
        'Cannot create user without an email address.',
      );

    const existingUser: UserEntity | null =
      await this.userRepo.findByEmail(email);

    if (existingUser)
      throw new ConflictException('A user with this email already exists.');

    const status: AccountStatusEntity = await this.getDefaultAccountStatus();
    const user: UserEntity = await this.userRepo.createUser({
      ...input,
      credentials: {
        refresh: null,
        token_version: 0,
      },
      status: { id: status.id },
    });

    return this.userRepo.findByIdOrFail(user.id);
  }
}
