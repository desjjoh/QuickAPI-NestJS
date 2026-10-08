import { IsNull } from 'typeorm';

import { AccountTokenType } from '@/config/token.config';

import { AccountTokenEntity } from '../entities/account-token.entity';
import { AccountTokenRepository } from './account-token.repository';

describe('AccountTokenRepository', () => {
  const persistence = { findOne: jest.fn() };
  const manager = { getRepository: jest.fn().mockReturnValue(persistence) };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue({
      target: AccountTokenEntity,
      manager,
    }),
  };
  let repository: AccountTokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.getRepository.mockReturnValue(persistence);
    persistence.findOne.mockResolvedValue(null);
    repository = new AccountTokenRepository(dataSource as never);
  });

  it('finds an unconsumed token by id and purpose with its user', async () => {
    await expect(
      repository.findPendingById(
        manager as never,
        'token-1',
        AccountTokenType.PASSWORD_RESET,
      ),
    ).resolves.toBeNull();

    expect(manager.getRepository).toHaveBeenCalledWith(AccountTokenEntity);
    expect(persistence.findOne).toHaveBeenCalledWith({
      where: {
        id: 'token-1',
        type: AccountTokenType.PASSWORD_RESET,
        consumed_at: IsNull(),
      },
      relations: { user: true },
    });
  });

  it('finds an unconsumed token by user and purpose with its user', async () => {
    await repository.findPendingByUser(
      manager as never,
      'user-1',
      AccountTokenType.EMAIL_VERIFICATION,
    );

    expect(persistence.findOne).toHaveBeenCalledWith({
      where: {
        user: { id: 'user-1' },
        type: AccountTokenType.EMAIL_VERIFICATION,
        consumed_at: IsNull(),
      },
      relations: { user: true },
    });
  });

  it('exposes reads but no persistence mutation API', () => {
    expect(repository).not.toHaveProperty('save');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('delete');
    expect(repository).not.toHaveProperty('remove');
  });
});
