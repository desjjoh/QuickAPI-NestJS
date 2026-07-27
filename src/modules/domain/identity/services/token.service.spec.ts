jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

import {
  AccountTokenType,
  MAX_VERIFICATION_CODE_ATTEMPTS,
} from '@/config/token.config';
import { AccountTokenService } from './token.service';

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

describe('AccountTokenService', () => {
  const user = { id: 'u1' };
  const query = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn(),
  };
  const repo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { getRepository: jest.fn(), transaction: jest.fn() },
  };
  let service: AccountTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['update', 'set', 'where', 'andWhere'] as const)
      query[method].mockReturnValue(query);
    query.execute.mockResolvedValue({ affected: 1 });
    repo.createQueryBuilder.mockReturnValue(query);
    repo.manager.getRepository.mockReturnValue(repo);
    repo.manager.transaction.mockImplementation(async (callback) =>
      callback(repo.manager),
    );
    repo.create.mockImplementation((value) => value);
    repo.save.mockImplementation(async (value) => ({ id: 't1', ...value }));
    repo.update.mockResolvedValue({ affected: 1 });
    service = new AccountTokenService(repo as never);
  });

  const entity = (overrides = {}) => ({
    id: 't1',
    user,
    type: AccountTokenType.PASSWORD_RESET,
    token_hash: hash('plain-token'),
    mfa_code_hash: hash('123456'),
    expires_at: new Date(Date.now() + 60_000),
    consumed_at: null,
    locked_at: null,
    failed_attempts: 0,
    metadata: { state: 'pending', purpose: 'sign-in' },
    ...overrides,
  });

  it('creates a token, revokes predecessors, and persists only its hash', async () => {
    const result = await service.createToken({
      user: user as never,
      type: AccountTokenType.PASSWORD_RESET,
      expiresInMs: 60_000,
      metadata: { state: 'pending' },
      mfaCodeHash: hash('123456'),
    });
    expect(repo.update).toHaveBeenCalledTimes(1);
    const stored = repo.create.mock.calls[0][0];
    expect(result.token).toBeTruthy();
    expect(stored.token_hash).toBe(hash(result.token));
    expect(stored.token_hash).not.toBe(result.token);
    expect(stored.mfa_code_hash).toBe(hash('123456'));
  });

  it('validates a correctly typed, unconsumed, unexpired token', async () => {
    const value = entity();
    repo.findOne.mockResolvedValue(value);
    await expect(
      service.validateToken(
        't1',
        AccountTokenType.PASSWORD_RESET,
        'plain-token',
      ),
    ).resolves.toBe(value);
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: AccountTokenType.PASSWORD_RESET,
        }),
      }),
    );
  });

  it.each([
    ['missing, revoked, consumed, or incorrectly typed', null],
    ['expired', entity({ expires_at: new Date(Date.now() - 1) })],
    ['incorrectly hashed', entity({ token_hash: hash('other') })],
  ])('rejects a %s token', async (_label, value) => {
    repo.findOne.mockResolvedValue(value);
    await expect(
      service.validateToken(
        't1',
        AccountTokenType.PASSWORD_RESET,
        'plain-token',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('consumes a token and replaces its metadata atomically', async () => {
    repo.findOne.mockResolvedValue(entity());
    const result = await service.consumeToken(
      't1',
      AccountTokenType.PASSWORD_RESET,
      'plain-token',
      { state: 'pending' },
      { state: 'consumed' },
    );
    expect(result.metadata).toEqual({ state: 'consumed' });
    expect(result.consumed_at).toBeInstanceOf(Date);
  });

  it('rejects incorrectly purposed metadata and token-consumption replay', async () => {
    repo.findOne.mockResolvedValue(entity());
    await expect(
      service.consumeToken(
        't1',
        AccountTokenType.PASSWORD_RESET,
        'plain-token',
        { state: 'verified' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    repo.update.mockResolvedValue({ affected: 0 });
    await expect(
      service.consumeToken(
        't1',
        AccountTokenType.PASSWORD_RESET,
        'plain-token',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('consumes a valid MFA code for the expected user and purpose', async () => {
    repo.findOne.mockResolvedValue(entity());
    const result = await service.consumeMfaCode(
      't1',
      AccountTokenType.PASSWORD_RESET,
      '123456',
      { purpose: 'sign-in' },
      'u1',
    );
    expect(result.consumed_at).toBeInstanceOf(Date);
    expect(query.execute).toHaveBeenCalled();
  });

  it.each([
    ['expired', { expires_at: new Date(0) }],
    ['revoked/consumed/incorrectly typed', null],
    ['locked', { locked_at: new Date() }],
    ['maximum attempts', { failed_attempts: MAX_VERIFICATION_CODE_ATTEMPTS }],
    ['wrong user', { user: { id: 'other' } }],
    ['wrong purpose', { metadata: { purpose: 'enable' } }],
  ])('rejects MFA tokens that are %s', async (_label, override) => {
    repo.findOne.mockResolvedValue(override === null ? null : entity(override));
    await expect(
      service.consumeMfaCode(
        't1',
        AccountTokenType.PASSWORD_RESET,
        '123456',
        { purpose: 'sign-in' },
        'u1',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('records a failed attempt for malformed and incorrectly hashed MFA codes', async () => {
    repo.findOne.mockResolvedValue(entity());
    await expect(
      service.consumeMfaCode('t1', AccountTokenType.PASSWORD_RESET, '654321', {
        purpose: 'sign-in',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.createQueryBuilder).toHaveBeenCalled();
    expect(query.set).toHaveBeenNthCalledWith(1, {
      failed_attempts: expect.any(Function),
    });
    expect(query.set).toHaveBeenNthCalledWith(2, {
      locked_at: expect.any(Function),
    });
  });

  it('authorizes a valid MFA challenge and stores a hash, never the returned token', async () => {
    repo.findOne.mockResolvedValue(entity());
    const result = await service.authorizeMfaCode({
      userId: 'u1',
      type: AccountTokenType.PASSWORD_RESET,
      code: '123456',
      pendingMetadata: { state: 'pending' },
      verifiedMetadata: { state: 'verified' },
      expiresInMs: 1000,
    });
    const update = repo.update.mock.calls.at(-1)?.[1];
    expect(update.token_hash).toBe(hash(result.token));
    expect(update.token_hash).not.toBe(result.token);
    expect(update.mfa_code_hash).toBeNull();
  });

  it.each([
    ['expired', entity({ expires_at: new Date(0) })],
    ['incorrect purpose', entity({ metadata: { state: 'other' } })],
    ['malformed code', entity()],
    ['incorrect hash', entity()],
  ])('rejects authorization for an %s challenge', async (label, value) => {
    repo.findOne.mockResolvedValue(value);
    const code =
      label === 'malformed code'
        ? '12'
        : label === 'incorrect hash'
          ? '654321'
          : '123456';
    await expect(
      service.authorizeMfaCode({
        userId: 'u1',
        type: AccountTokenType.PASSWORD_RESET,
        code,
        pendingMetadata: { state: 'pending' },
        verifiedMetadata: {},
        expiresInMs: 1,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes active tokens by user and type', async () => {
    await service.revokeActiveTokens('u1', AccountTokenType.EMAIL_MFA);
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 'u1' },
        type: AccountTokenType.EMAIL_MFA,
      }),
      expect.objectContaining({ consumed_at: expect.any(Date) }),
    );
  });
});
