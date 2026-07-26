import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { EntityManager, IsNull, Repository } from 'typeorm';

import {
  RegistrationTokenEntity,
  RegistrationTokenMetadata,
} from '../entities/registration-token.entity';
import { CreatedAccountToken } from './token.service';
import { MAX_VERIFICATION_CODE_ATTEMPTS } from '@/config/token.config';

export type CreateRegistrationTokenOptions = {
  email: string;
  expiresInMs: number;
  metadata: RegistrationTokenMetadata;
  mfaCodeHash?: string | null;
};

@Injectable()
export class RegistrationTokenService {
  public constructor(
    @InjectRepository(RegistrationTokenEntity)
    private readonly tokenRepo: Repository<RegistrationTokenEntity>,
  ) {}

  public async createToken({
    email,
    expiresInMs,
    metadata,
    mfaCodeHash = null,
  }: CreateRegistrationTokenOptions): Promise<CreatedAccountToken> {
    await this.revokeActiveTokens(email);

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const entity = this.tokenRepo.create({
      email,
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

  public async findPendingByEmail(
    email: string,
  ): Promise<RegistrationTokenEntity | null> {
    return this.tokenRepo.findOne({
      where: {
        email,
        consumed_at: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
  }

  public async validateToken(
    tokenId: string,
    token: string,
  ): Promise<RegistrationTokenEntity> {
    const entity = await this.tokenRepo.findOne({
      where: {
        id: tokenId,
        consumed_at: IsNull(),
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
    token: string,
  ): Promise<RegistrationTokenEntity> {
    const entity = await this.validateToken(tokenId, token);

    const consumedAt = new Date();
    const result = await this.tokenRepo.update(
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
    manager: EntityManager = this.tokenRepo.manager,
  ): Promise<RegistrationTokenEntity> {
    const repo = manager.getRepository(RegistrationTokenEntity);
    const entity = await repo.findOne({
      where: { id: challengeId, consumed_at: IsNull() },
    });

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired challenge.');

    if (
      entity.locked_at ||
      entity.failed_attempts >= MAX_VERIFICATION_CODE_ATTEMPTS
    )
      throw new UnauthorizedException('Invalid or expired challenge.');

    const codeHash = this.hashToken(code);

    if (
      !entity.mfa_code_hash ||
      !/^\d{6}$/.test(code) ||
      !this.compareTokenHashes(entity.mfa_code_hash, codeHash)
    ) {
      await this.recordFailedAttempt(entity.id);
      throw new UnauthorizedException('Invalid or expired challenge.');
    }

    const consumedAt = new Date();
    const result = await repo
      .createQueryBuilder()
      .update(RegistrationTokenEntity)
      .set({ consumed_at: consumedAt })
      .where('id = :id', { id: entity.id })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts < :maxAttempts', {
        maxAttempts: MAX_VERIFICATION_CODE_ATTEMPTS,
      })
      .andWhere('expires_at > :now', { now: consumedAt })
      .andWhere('mfa_code_hash = :codeHash', { codeHash })
      .execute();

    if (result.affected !== 1)
      throw new UnauthorizedException('Invalid or expired challenge.');

    return { ...entity, consumed_at: consumedAt };
  }

  private async recordFailedAttempt(id: string): Promise<void> {
    await this.tokenRepo
      .createQueryBuilder()
      .update(RegistrationTokenEntity)
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

  private async revokeActiveTokens(email: string): Promise<void> {
    await this.tokenRepo.update(
      {
        email,
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
}
