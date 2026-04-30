import { Inject, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

import type {
  DecodedToken,
  JwtPayload,
  RefreshPayload,
  TokenPair,
  TokenServiceOptions,
} from '../types/token.types';
import { TOKEN_SERVICE_OPTIONS } from '../tokens/options.token';

export class TokenService {
  public constructor(
    private readonly jwtService: JwtService,

    @Inject(TOKEN_SERVICE_OPTIONS)
    private readonly options: TokenServiceOptions,
  ) {
    this.assertConfig();
  }

  public async createTokenPair(payload: RefreshPayload): Promise<TokenPair> {
    const basePayload: JwtPayload = {
      sub: payload.sub,
      email: payload.email,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.createAccessToken(basePayload),
      this.createRefreshToken(payload),
    ]);

    return { access_token, refresh_token };
  }

  public async createAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.options.jwtSecret,
      expiresIn: this.options.jwtExpiryTime,
    });
  }

  public async createRefreshToken(payload: RefreshPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.options.refreshSecret,
      expiresIn: this.options.refreshExpiryTime,
    });
  }

  public async verifyAccessToken(token: string): Promise<DecodedToken> {
    return this.jwtService.verifyAsync<DecodedToken>(token, {
      secret: this.options.jwtSecret,
    });
  }

  public async verifyRefreshToken(token: string): Promise<DecodedToken> {
    return this.jwtService.verifyAsync<DecodedToken>(token, {
      secret: this.options.refreshSecret,
    });
  }

  public decode(token: string): DecodedToken {
    return this.jwtService.decode(token) as DecodedToken;
  }

  public hashToken(token: string): string {
    return createHmac('sha256', this.options.cryptoSecret)
      .update(token)
      .digest('hex');
  }

  public compareTokenHash(token: string, hashedToken: string): boolean {
    const expectedHash = this.hashToken(token);

    const expected = Buffer.from(expectedHash, 'hex');
    const received = Buffer.from(hashedToken, 'hex');

    if (expected.length !== received.length) return false;

    return timingSafeEqual(expected, received);
  }

  public createCsrfToken(): { secret: string; token: string } {
    const secret = randomBytes(32).toString('hex');

    const token = createHmac('sha256', this.options.cryptoSecret)
      .update(secret)
      .digest('hex');

    return { secret, token };
  }

  public verifyCsrfToken(secret: string, token: string): boolean {
    const expected = createHmac('sha256', this.options.cryptoSecret)
      .update(secret)
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(token);

    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  }

  private assertConfig(): void {
    const missing: string[] = [];

    if (!this.options.jwtSecret) missing.push('JWT_SECRET_KEY');
    if (!this.options.jwtExpiryTime) missing.push('JWT_EXPIRY_TIME');
    if (!this.options.refreshSecret) missing.push('REFRESH_SECRET_KEY');
    if (!this.options.refreshExpiryTime) missing.push('REFRESH_EXPIRY_TIME');
    if (!this.options.cryptoSecret) missing.push('CRYPTO_SECRET');

    if (missing.length === 0) return;

    throw new InternalServerErrorException(
      `Token configuration missing: ${missing.join(', ')}`,
    );
  }
}
