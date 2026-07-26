import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { AccountTokenEntity } from '../entities/account-token.entity';
import { UserEntity } from '../entities/user.entity';
import {
  AccountTokenType,
  MAX_VERIFICATION_CODE_ATTEMPTS,
} from '@/config/token.config';

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

export type AuthorizeAccountTokenOptions = {
  userId: string;
  type: AccountTokenType;
  code: string;
  pendingMetadata: AccountTokenMetadata;
  verifiedMetadata: AccountTokenMetadata;
  expiresInMs: number;
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
      failed_attempts: 0,
      locked_at: null,
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
    expectedMetadata?: AccountTokenMetadata,
    consumedMetadata?: AccountTokenMetadata,
  ): Promise<AccountTokenEntity> {
    const entity = await this.validateToken(tokenId, type, token);

    if (
      expectedMetadata &&
      !this.matchesMetadata(entity.metadata, expectedMetadata)
    )
      throw new UnauthorizedException('Invalid or expired token.');

    const consumedAt = new Date();
    const metadata = consumedMetadata ?? entity.metadata;
    const result = await this.tokenRepo.update(
      { id: entity.id, consumed_at: IsNull() },
      {
        consumed_at: consumedAt,
        metadata,
      } as QueryDeepPartialEntity<AccountTokenEntity>,
    );

    if (result.affected !== 1)
      throw new UnauthorizedException('Invalid or expired token.');

    return { ...entity, consumed_at: consumedAt, metadata };
  }

  public async consumeMfaCode(
    tokenId: string,
    type: AccountTokenType,
    code: string,
    expectedMetadata: AccountTokenMetadata,
    userId?: string,
    manager: EntityManager = this.tokenRepo.manager,
  ): Promise<AccountTokenEntity> {
    const repo = manager.getRepository(AccountTokenEntity);
    const entity = await repo.findOne({
      where: { id: tokenId, type, consumed_at: IsNull() },
      relations: { user: true },
    });

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired token.');

    if (
      entity.locked_at ||
      entity.failed_attempts >= MAX_VERIFICATION_CODE_ATTEMPTS
    )
      throw new UnauthorizedException('Invalid or expired token.');

    if (userId && entity.user.id !== userId)
      throw new UnauthorizedException('Invalid or expired token.');

    if (!this.matchesMetadata(entity.metadata, expectedMetadata))
      throw new UnauthorizedException('Invalid or expired token.');

    if (
      !entity.mfa_code_hash ||
      !/^\d{6}$/.test(code) ||
      !this.compareTokenHashes(entity.mfa_code_hash, this.hashToken(code))
    ) {
      await this.recordFailedAttempt(entity.id);
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const consumedAt = new Date();
    const result = await repo
      .createQueryBuilder()
      .update(AccountTokenEntity)
      .set({ consumed_at: consumedAt })
      .where('id = :id', { id: entity.id })
      .andWhere('type = :type', { type })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts < :maxAttempts', {
        maxAttempts: MAX_VERIFICATION_CODE_ATTEMPTS,
      })
      .andWhere('expires_at > :now', { now: consumedAt })
      .andWhere('mfa_code_hash = :codeHash', {
        codeHash: entity.mfa_code_hash,
      })
      .execute();

    if (result.affected !== 1)
      throw new UnauthorizedException('Invalid or expired token.');

    return { ...entity, consumed_at: consumedAt };
  }

  private async recordFailedAttempt(id: string): Promise<void> {
    await this.tokenRepo
      .createQueryBuilder()
      .update(AccountTokenEntity)
      .set({
        failed_attempts: () => '`failed_attempts` + 1',
        locked_at: () =>
          `CASE WHEN \`failed_attempts\` + 1 >= ${MAX_VERIFICATION_CODE_ATTEMPTS} THEN CURRENT_TIMESTAMP ELSE \`locked_at\` END`,
      })
      .where('id = :id', { id })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts < :maxAttempts', {
        maxAttempts: MAX_VERIFICATION_CODE_ATTEMPTS,
      })
      .execute();
  }

  public async authorizeMfaCode({
    userId,
    type,
    code,
    pendingMetadata,
    verifiedMetadata,
    expiresInMs,
  }: AuthorizeAccountTokenOptions): Promise<CreatedAccountToken> {
    const entity: AccountTokenEntity | null = await this.tokenRepo.findOne({
      where: { user: { id: userId }, type, consumed_at: IsNull() },
      relations: { user: true },
    });

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired challenge.');

    if (!this.matchesMetadata(entity.metadata, pendingMetadata))
      throw new UnauthorizedException('Invalid or expired challenge.');

    if (!entity.mfa_code_hash || !/^\d{6}$/.test(code))
      throw new UnauthorizedException('Invalid verification code.');

    if (!this.compareTokenHashes(entity.mfa_code_hash, this.hashToken(code)))
      throw new UnauthorizedException('Invalid verification code.');

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInMs);
    const tokenHash = this.hashToken(token);
    const result = await this.tokenRepo.update(
      {
        id: entity.id,
        consumed_at: IsNull(),
        mfa_code_hash: entity.mfa_code_hash,
      },
      {
        token_hash: tokenHash,
        mfa_code_hash: null,
        metadata: verifiedMetadata,
        expires_at: expiresAt,
      } as QueryDeepPartialEntity<AccountTokenEntity>,
    );

    if (result.affected !== 1)
      throw new UnauthorizedException('Invalid or expired challenge.');

    return { id: entity.id, token, expires_at: expiresAt };
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
