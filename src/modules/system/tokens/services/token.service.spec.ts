import { InternalServerErrorException } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { TokenService } from './token.service';
import { TokenServiceOptions } from '../types/token.types';

describe('TokenService', () => {
  const options: TokenServiceOptions = {
    jwtSecret: 'access-secret',
    jwtExpiryTime: '15m',
    refreshSecret: 'refresh-secret',
    refreshExpiryTime: '7d',
    cryptoSecret: 'crypto-secret',
  };
  const jwt = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };
  let service: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokenService(jwt as never, options);
  });

  it('rejects every missing required configuration value', () => {
    expect(
      () => new TokenService(jwt as never, {} as TokenServiceOptions),
    ).toThrow(
      new InternalServerErrorException(
        'Token configuration missing: JWT_SECRET_KEY, JWT_EXPIRY_TIME, REFRESH_SECRET_KEY, REFRESH_EXPIRY_TIME, CRYPTO_SECRET',
      ),
    );
  });

  it('creates an access and refresh token pair with separate secrets', async () => {
    jwt.signAsync
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');
    const payload = { sub: 'u1', email: 'a@b.test', version: 2, sid: 's1' };

    await expect(service.createTokenPair(payload)).resolves.toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
    });
    expect(jwt.signAsync).toHaveBeenNthCalledWith(1, payload, {
      secret: options.jwtSecret,
      expiresIn: options.jwtExpiryTime,
    });
    expect(jwt.signAsync).toHaveBeenNthCalledWith(2, payload, {
      secret: options.refreshSecret,
      expiresIn: options.refreshExpiryTime,
    });
  });

  it('creates individual tokens and propagates signing rejection', async () => {
    jwt.signAsync
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');
    await expect(
      service.createAccessToken({ sub: 'u' } as never),
    ).resolves.toBe('access');
    await expect(
      service.createRefreshToken({ sub: 'u' } as never),
    ).resolves.toBe('refresh');
    jwt.signAsync.mockRejectedValueOnce(new Error('sign failed'));
    await expect(
      service.createAccessToken({ sub: 'u' } as never),
    ).rejects.toThrow('sign failed');
  });

  it('verifies access and refresh tokens using their respective secrets', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u' });
    await expect(service.verifyAccessToken('a')).resolves.toEqual({ sub: 'u' });
    await expect(service.verifyRefreshToken('r')).resolves.toEqual({
      sub: 'u',
    });
    expect(jwt.verifyAsync).toHaveBeenNthCalledWith(1, 'a', {
      secret: options.jwtSecret,
    });
    expect(jwt.verifyAsync).toHaveBeenNthCalledWith(2, 'r', {
      secret: options.refreshSecret,
    });
  });

  it('decodes tokens', () => {
    jwt.decode.mockReturnValue({ exp: 123 });
    expect(service.decode('token')).toEqual({ exp: 123 });
  });

  it('hashes and compares tokens without storing plaintext', () => {
    const expected = createHmac('sha256', options.cryptoSecret)
      .update('token')
      .digest('hex');
    expect(service.hashToken('token')).toBe(expected);
    expect(expected).not.toContain('token');
    expect(service.compareTokenHash('token', expected)).toBe(true);
    expect(service.compareTokenHash('wrong', expected)).toBe(false);
    expect(service.compareTokenHash('token', 'abcd')).toBe(false);
  });

  it('creates and verifies CSRF tokens, including malformed values', () => {
    const csrf = service.createCsrfToken();
    expect(csrf.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(csrf.token).toBe(
      createHmac('sha256', options.cryptoSecret)
        .update(csrf.secret)
        .digest('hex'),
    );
    expect(service.verifyCsrfToken(csrf.secret, csrf.token)).toBe(true);
    expect(service.verifyCsrfToken(csrf.secret, `${csrf.token}00`)).toBe(false);
    expect(service.verifyCsrfToken('other', csrf.token)).toBe(false);
  });
});
