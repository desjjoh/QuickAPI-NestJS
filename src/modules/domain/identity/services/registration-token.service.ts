import {
  applicationManager,
  afterApplicationTransaction,
} from '@/common/helpers/transaction.helper';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';

import {
  RegistrationTokenEntity,
  RegistrationTokenMetadata,
} from '../entities/registration-token.entity';
import { CreatedAccountToken } from './token.service';
import { MAX_VERIFICATION_CODE_ATTEMPTS } from '@/config/token.config';
import { RegistrationTokenRepository } from '../repositories/registration-token.repository';
import {
  compareIdentityTokenHashes,
  generateIdentityToken,
  hashIdentityToken,
  isVerificationCode,
} from './token-security';

export type CreateRegistrationTokenOptions = {
  email: string;
  expiresInMs: number;
  metadata: RegistrationTokenMetadata;
  mfaCodeHash?: string | null;
};

@Injectable()
export class RegistrationTokenService {
  public constructor(private readonly tokenRepo: RegistrationTokenRepository) {}

  public async createToken(
    {
      email,
      expiresInMs,
      metadata,
      mfaCodeHash = null,
    }: CreateRegistrationTokenOptions,
    manager: EntityManager = applicationManager(this.tokenRepo.manager),
  ): Promise<CreatedAccountToken> {
    await this.revokeActiveTokens(email, manager);

    const token = generateIdentityToken();
    const tokenHash = hashIdentityToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const entity = this.tokenRepo.instantiate(manager, {
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      consumed_at: null,
      mfa_code_hash: mfaCodeHash,
      metadata,
    });

    const saved = await this.tokenRepo.save(manager, entity);

    return {
      id: saved.id,
      token,
      expires_at: saved.expires_at,
    };
  }

  public async findPendingByEmail(
    email: string,
    manager: EntityManager = applicationManager(this.tokenRepo.manager),
  ): Promise<RegistrationTokenEntity | null> {
    return this.tokenRepo.findPendingByEmail(manager, email);
  }

  public async validateToken(
    tokenId: string,
    token: string,
    manager: EntityManager = applicationManager(this.tokenRepo.manager),
  ): Promise<RegistrationTokenEntity> {
    const entity = await this.tokenRepo.findPendingById(manager, tokenId);

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
    token: string,
    manager: EntityManager = applicationManager(this.tokenRepo.manager),
  ): Promise<RegistrationTokenEntity> {
    const entity = await this.validateToken(tokenId, token, manager);

    const consumedAt = new Date();
    const result = await this.tokenRepo.patch(
      manager,
      { id: entity.id, consumed_at: IsNull() },
      { consumed_at: consumedAt },
    );

    if (result.affected !== 1)
      throw new UnauthorizedException('Invalid or expired token.');

    return { ...entity, consumed_at: consumedAt };
  }

  public async consumeVerificationCode(
    challengeId: string,
    code: string,
    manager: EntityManager = applicationManager(this.tokenRepo.manager),
  ): Promise<RegistrationTokenEntity> {
    const entity = await this.tokenRepo.findPendingById(manager, challengeId);

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired challenge.');

    if (
      entity.locked_at ||
      entity.failed_attempts >= MAX_VERIFICATION_CODE_ATTEMPTS
    )
      throw new UnauthorizedException('Invalid or expired challenge.');

    const codeHash = hashIdentityToken(code);

    if (
      !entity.mfa_code_hash ||
      !isVerificationCode(code) ||
      !compareIdentityTokenHashes(entity.mfa_code_hash, codeHash)
    ) {
      await this.recordFailedAttempt(entity.id);

      throw new UnauthorizedException('Invalid or expired challenge.');
    }

    const consumedAt = new Date();
    const result = await this.tokenRepo.consumeCode(
      manager,
      entity,
      codeHash,
      consumedAt,
      MAX_VERIFICATION_CODE_ATTEMPTS,
    );

    if (result.affected !== 1)
      throw new UnauthorizedException('Invalid or expired challenge.');

    return { ...entity, consumed_at: consumedAt };
  }

  private async recordFailedAttempt(id: string): Promise<void> {
    // Use an independent autocommit statement, not the failed request transaction.
    await afterApplicationTransaction(() =>
      this.tokenRepo.recordFailedAttempt(
        this.tokenRepo.manager,
        id,
        MAX_VERIFICATION_CODE_ATTEMPTS,
      ),
    );
  }

  private async revokeActiveTokens(
    email: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.tokenRepo.patch(
      manager,
      {
        email,
        consumed_at: IsNull(),
      },
      {
        consumed_at: new Date(),
      },
    );
  }
}
