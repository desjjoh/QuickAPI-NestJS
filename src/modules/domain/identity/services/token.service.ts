import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { IsNull, Repository } from 'typeorm';

import { AccountTokenEntity } from '../entities/account-token.entity';
import { UserEntity } from '../entities/user.entity';
import { AccountTokenType } from '@/config/token.config';

export type AccountTokenMetadata = Record<string, unknown>;

export type CreateAccountTokenOptions = {
  user: UserEntity;
  type: AccountTokenType;
  expiresInMs: number;
  metadata?: AccountTokenMetadata | null;
  mfaCodeHash?: string | null;
};

export type CreatedAccountToken = {
  id: string;
  token: string;
  expires_at: Date;
};

@Injectable()
export class AccountTokenService {
  public constructor(
    @InjectRepository(AccountTokenEntity)
    private readonly tokenRepo: Repository<AccountTokenEntity>,
  ) {}

  public async createToken({
    user,
    type,
    expiresInMs,
    metadata = null,
    mfaCodeHash = null,
  }: CreateAccountTokenOptions): Promise<CreatedAccountToken> {
    await this.revokeActiveTokens(user.id, type);

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const entity = this.tokenRepo.create({
      user: { id: user.id },
      type,
      token_hash: tokenHash,
      expires_at: expiresAt,
      consumed_at: null,
      mfa_code_hash: mfaCodeHash,
      metadata,
    });

    const saved = await this.tokenRepo.save(entity);

    return {
      id: saved.id,
      token,
      expires_at: saved.expires_at,
    };
  }

  public async validateToken(
    tokenId: string,
    type: AccountTokenType,
    token: string,
  ): Promise<AccountTokenEntity> {
    const entity = await this.tokenRepo.findOne({
      where: {
        id: tokenId,
        type,
        consumed_at: IsNull(),
      },
      relations: {
        user: true,
      },
    });

    if (!entity) throw new UnauthorizedException('Invalid or expired token.');

    const isExpired = entity.expires_at.getTime() <= Date.now();

    if (isExpired) throw new UnauthorizedException('Invalid or expired token.');

    const tokenHash = this.hashToken(token);
    const isMatch = this.compareTokenHashes(entity.token_hash, tokenHash);

    if (!isMatch) throw new UnauthorizedException('Invalid or expired token.');

    return entity;
  }

  public async consumeToken(
    tokenId: string,
    type: AccountTokenType,
    token: string,
  ): Promise<AccountTokenEntity> {
    const entity = await this.validateToken(tokenId, type, token);

    return this.tokenRepo.save({ ...entity, consumed_at: new Date() });
  }

  public async consumeMfaCode(
    tokenId: string,
    type: AccountTokenType,
    code: string,
    expectedMetadata: AccountTokenMetadata,
    userId?: string,
  ): Promise<AccountTokenEntity> {
    const entity = await this.tokenRepo.findOne({
      where: { id: tokenId, type, consumed_at: IsNull() },
      relations: { user: true },
    });

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired token.');
    if (userId && entity.user.id !== userId)
      throw new UnauthorizedException('Invalid or expired token.');
    if (!this.matchesMetadata(entity.metadata, expectedMetadata))
      throw new UnauthorizedException('Invalid or expired token.');
    if (!entity.mfa_code_hash || !/^\d{6}$/.test(code))
      throw new UnauthorizedException('Invalid verification code.');

    if (!this.compareTokenHashes(entity.mfa_code_hash, this.hashToken(code)))
      throw new UnauthorizedException('Invalid verification code.');

    return this.tokenRepo.save({ ...entity, consumed_at: new Date() });
  }

  public async revokeActiveTokens(
    userId: string,
    type: AccountTokenType,
  ): Promise<void> {
    await this.tokenRepo.update(
      {
        user: { id: userId },
        type,
        consumed_at: IsNull(),
      },
      {
        consumed_at: new Date(),
      },
    );
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private compareTokenHashes(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(actual, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private matchesMetadata(
    metadata: AccountTokenMetadata | null,
    expectedMetadata: AccountTokenMetadata,
  ): boolean {
    return Object.entries(expectedMetadata).every(
      ([key, value]) => metadata?.[key] === value,
    );
  }
}
