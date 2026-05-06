import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';

import { day } from '@/common/constants/milliseconds.constants';
import { TokenService } from '@/modules/system/tokens/services/token.service';

import { JWTDto } from '../models/jwt.model';
import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { DeepPartial } from 'typeorm';
import { UserAddressEntity } from '../entities/address.entity';

@Injectable()
export class IdentityService {
  public constructor(
    private readonly tokenSvc: TokenService,
    private readonly userRepo: UserRepository,
  ) {}

  public async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity> {
    const user = await this.userRepo.findByEmail(email);

    if (!user?.identity?.password)
      throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.identity.password);

    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  public hasPermission(user: UserEntity, keys: string[]): void {
    const userPermissions = new Set(
      user.roles?.flatMap(
        (role) => role.permissions?.map((permission) => permission.key) ?? [],
      ) ?? [],
    );

    const hasPermission = keys.some((key) => userPermissions.has(key));

    if (!hasPermission)
      throw new UnauthorizedException('User does not have required permission');
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  public async issueTokens(user: UserEntity, res: Response): Promise<JWTDto> {
    const tokens = await this.tokenSvc.createTokenPair({
      sub: user.id,
      email: user.identity.email,
      version: user.credentials.token_version,
    });

    const hashedRefreshToken = this.tokenSvc.hashToken(tokens.refresh_token);

    await this.updateRefreshToken(user, hashedRefreshToken);

    const accessToken = this.tokenSvc.decode(tokens.access_token);
    const refreshToken = this.tokenSvc.decode(tokens.refresh_token);

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 7 * day,
    });

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

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  private async updateRefreshToken(
    user: UserEntity,
    refresh: string,
  ): Promise<UserEntity> {
    const updatedUser = this.userRepo.merge(user, {
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

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
}
