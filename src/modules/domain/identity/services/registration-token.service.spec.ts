jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

import { MAX_VERIFICATION_CODE_ATTEMPTS } from '@/config/token.config';
import { RegistrationTokenService } from './registration-token.service';

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

describe('RegistrationTokenService', () => {
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
    manager: { getRepository: jest.fn() },
  };
  let service: RegistrationTokenService;
  const metadata = {
    email: 'new@test.dev',
    password: 'hash',
    profile: { name: { first: 'New' } },
  };
  const entity = (overrides = {}) => ({
    id: 'r1',
    email: 'new@test.dev',
    token_hash: hash('plain'),
    mfa_code_hash: hash('123456'),
    expires_at: new Date(Date.now() + 10000),
    consumed_at: null,
    locked_at: null,
    failed_attempts: 0,
    metadata,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['update', 'set', 'where', 'andWhere'] as const)
      query[method].mockReturnValue(query);
    query.execute.mockResolvedValue({ affected: 1 });
    repo.createQueryBuilder.mockReturnValue(query);
    repo.manager.getRepository.mockReturnValue(repo);
    repo.create.mockImplementation((x) => x);
    repo.save.mockImplementation(async (x) => ({ id: 'r1', ...x }));
    repo.update.mockResolvedValue({ affected: 1 });
    service = new RegistrationTokenService(repo as never);
  });

  it('revokes prior tokens and stores only a hash of a new registration token', async () => {
    const result = await service.createToken({
      email: 'new@test.dev',
      expiresInMs: 1000,
      metadata: metadata as never,
      mfaCodeHash: hash('123456'),
    });
    const stored = repo.create.mock.calls[0][0];
    expect(stored.token_hash).toBe(hash(result.token));
    expect(stored.token_hash).not.toBe(result.token);
    expect(stored.mfa_code_hash).not.toBe('123456');
    expect(repo.update).toHaveBeenCalled();
  });

  it('finds the newest unconsumed registration', async () => {
    const pendingToken = entity();
    repo.findOne.mockResolvedValue(pendingToken);
    await expect(service.findPendingByEmail('new@test.dev')).resolves.toEqual(
      pendingToken,
    );
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ order: { createdAt: 'DESC' } }),
    );
  });

  it('validates and consumes a valid token', async () => {
    const validToken = entity();
    repo.findOne.mockResolvedValue(validToken);
    await expect(service.validateToken('r1', 'plain')).resolves.toEqual(
      validToken,
    );
    await expect(service.consumeToken('r1', 'plain')).resolves.toEqual(
      expect.objectContaining({ consumed_at: expect.any(Date) }),
    );
  });

  it.each([
    ['revoked or consumed', null],
    ['expired', entity({ expires_at: new Date(0) })],
    ['incorrectly hashed', entity({ token_hash: hash('wrong') })],
  ])('rejects %s tokens', async (_label, value) => {
    repo.findOne.mockResolvedValue(value);
    await expect(service.validateToken('r1', 'plain')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a consumption replay', async () => {
    repo.findOne.mockResolvedValue(entity());
    repo.update.mockResolvedValue({ affected: 0 });
    await expect(service.consumeToken('r1', 'plain')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('consumes a correctly hashed verification code atomically', async () => {
    repo.findOne.mockResolvedValue(entity());
    await expect(
      service.consumeVerificationCode('r1', '123456'),
    ).resolves.toEqual(
      expect.objectContaining({ consumed_at: expect.any(Date) }),
    );
  });

  it.each([
    ['expired', { expires_at: new Date(0) }],
    ['revoked or consumed', null],
    ['locked', { locked_at: new Date() }],
    ['maximum attempts', { failed_attempts: MAX_VERIFICATION_CODE_ATTEMPTS }],
  ])('rejects a %s challenge', async (_label, override) => {
    repo.findOne.mockResolvedValue(override === null ? null : entity(override));
    await expect(
      service.consumeVerificationCode('r1', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('records attempts for malformed and incorrectly hashed codes', async () => {
    repo.findOne.mockResolvedValue(entity());
    await expect(
      service.consumeVerificationCode('r1', '654321'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(query.set).toHaveBeenCalledWith(
      expect.objectContaining({
        failed_attempts: expect.any(Function),
        locked_at: expect.any(Function),
      }),
    );
  });
});
