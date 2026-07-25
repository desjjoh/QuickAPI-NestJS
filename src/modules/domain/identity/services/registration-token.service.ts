import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { IsNull, Repository } from 'typeorm';

import {
  RegistrationTokenEntity,
  RegistrationTokenMetadata,
} from '../entities/registration-token.entity';
import { CreatedAccountToken } from './token.service';

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

    return this.tokenRepo.save({ ...entity, consumed_at: new Date() });
  }

  public async consumeVerificationCode(
    challengeId: string,
    code: string,
  ): Promise<RegistrationTokenEntity> {
    const entity = await this.tokenRepo.findOne({
      where: { id: challengeId, consumed_at: IsNull() },
    });

    if (!entity || entity.expires_at.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid or expired challenge.');
    if (!entity.mfa_code_hash || !/^\d{6}$/.test(code))
      throw new UnauthorizedException('Invalid verification code.');

    const codeHash = this.hashToken(code);
    if (!this.compareTokenHashes(entity.mfa_code_hash, codeHash))
      throw new UnauthorizedException('Invalid verification code.');

    return this.tokenRepo.save({ ...entity, consumed_at: new Date() });
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
