import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { AccountTokenEntity } from '../entities/account-token.entity';
import { UserEntity } from '../entities/user.entity';
import {
  AccountTokenType,
  MAX_VERIFICATION_CODE_ATTEMPTS,
} from '@/config/token.config';
import { AccountTokenRepository } from '../repositories/account-token.repository';
import {
  compareIdentityTokenHashes,
  generateIdentityToken,
  hashIdentityToken,
  isVerificationCode,
  metadataMatches,
} from './token-security';

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
  public constructor(private readonly tokenRepo: AccountTokenRepository) {}

  public async createToken(
    {
      user,
      type,
      expiresInMs,
      metadata = null,
      mfaCodeHash = null,
    }: CreateAccountTokenOptions,
    manager: EntityManager = this.tokenRepo.manager,
  ): Promise<CreatedAccountToken> {
    await this.revokeActiveTokens(user.id, type, manager);

    const token = generateIdentityToken();
    const tokenHash = hashIdentityToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const entity = manager.create(AccountTokenEntity, {
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

    const saved = await manager.save(AccountTokenEntity, entity);

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
    manager: EntityManager = this.tokenRepo.manager,
  ): Promise<AccountTokenEntity> {
    const entity = await this.tokenRepo.findPendingById(manager, tokenId, type);

    if (!entity) throw new UnauthorizedException('Invalid or expired token.');

    const isExpired = entity.expires_at.getTime() <= Date.now();

    if (isExpired) throw new UnauthorizedException('Invalid or expired token.');

    const tokenHash = hashIdentityToken(token);
    const isMatch = compareIdentityTokenHashes(entity.token_hash, tokenHash);

    if (!isMatch) throw new UnauthorizedException('Invalid or expired token.');

    return entity;
  }

  public async consumeToken(
    tokenId: string,
    type: AccountTokenType,
    token: string,
    expectedMetadata?: AccountTokenMetadata,
    consumedMetadata?: AccountTokenMetadata,
    manager: EntityManager = this.tokenRepo.manager,
  ): Promise<AccountTokenEntity> {
    const entity = await this.validateToken(tokenId, type, token, manager);

    if (expectedMetadata && !metadataMatches(entity.metadata, expectedMetadata))
      throw new UnauthorizedException('Invalid or expired token.');

    const consumedAt = new Date();
    const metadata = consumedMetadata ?? entity.metadata;
    const result = await manager.update(
      AccountTokenEntity,
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
    const entity = await this.tokenRepo.findPendingById(manager, tokenId, type);

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired token.');

    if (
      entity.locked_at ||
      entity.failed_attempts >= MAX_VERIFICATION_CODE_ATTEMPTS
    )
      throw new UnauthorizedException('Invalid or expired token.');

    if (userId && entity.user.id !== userId)
      throw new UnauthorizedException('Invalid or expired token.');

    if (!metadataMatches(entity.metadata, expectedMetadata))
      throw new UnauthorizedException('Invalid or expired token.');

    if (
      !entity.mfa_code_hash ||
      !isVerificationCode(code) ||
      !compareIdentityTokenHashes(entity.mfa_code_hash, hashIdentityToken(code))
    ) {
      await this.recordFailedAttempt(entity.id, manager);
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const consumedAt = new Date();
    const result = await manager
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

  private async recordFailedAttempt(
    id: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.transaction(async (transactionManager) => {
      await transactionManager
        .createQueryBuilder()
        .update(AccountTokenEntity)
        .set({ failed_attempts: () => '`failed_attempts` + 1' })
        .where('id = :id', { id })
        .andWhere('consumed_at IS NULL')
        .andWhere('locked_at IS NULL')
        .andWhere('failed_attempts < :maxAttempts', {
          maxAttempts: MAX_VERIFICATION_CODE_ATTEMPTS,
        })
        .execute();

      await transactionManager
        .createQueryBuilder()
        .update(AccountTokenEntity)
        .set({ locked_at: () => 'CURRENT_TIMESTAMP' })
        .where('id = :id', { id })
        .andWhere('consumed_at IS NULL')
        .andWhere('locked_at IS NULL')
        .andWhere('failed_attempts >= :maxAttempts', {
          maxAttempts: MAX_VERIFICATION_CODE_ATTEMPTS,
        })
        .execute();
    });
  }

  public async authorizeMfaCode(
    {
      userId,
      type,
      code,
      pendingMetadata,
      verifiedMetadata,
      expiresInMs,
    }: AuthorizeAccountTokenOptions,
    manager: EntityManager = this.tokenRepo.manager,
  ): Promise<CreatedAccountToken> {
    const entity = await this.tokenRepo.findPendingByUser(
      manager,
      userId,
      type,
    );

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired challenge.');

    if (!metadataMatches(entity.metadata, pendingMetadata))
      throw new UnauthorizedException('Invalid or expired challenge.');

    if (
      entity.locked_at ||
      entity.failed_attempts >= MAX_VERIFICATION_CODE_ATTEMPTS
    )
      throw new UnauthorizedException('Invalid or expired challenge.');

    if (!entity.mfa_code_hash || !isVerificationCode(code)) {
      await this.recordFailedAttempt(entity.id, manager);
      throw new UnauthorizedException('Invalid verification code.');
    }

    if (
      !compareIdentityTokenHashes(entity.mfa_code_hash, hashIdentityToken(code))
    ) {
      await this.recordFailedAttempt(entity.id, manager);
      throw new UnauthorizedException('Invalid verification code.');
    }

    const token = generateIdentityToken();
    const expiresAt = new Date(Date.now() + expiresInMs);
    const tokenHash = hashIdentityToken(token);
    const result = await manager.update(
      AccountTokenEntity,
      {
        id: entity.id,
        consumed_at: IsNull(),
        mfa_code_hash: entity.mfa_code_hash,
        locked_at: IsNull(),
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
    manager: EntityManager = this.tokenRepo.manager,
  ): Promise<void> {
    await manager.update(
      AccountTokenEntity,
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
}
