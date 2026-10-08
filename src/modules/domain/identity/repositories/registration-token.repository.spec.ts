import { IsNull } from 'typeorm';

import { RegistrationTokenEntity } from '../entities/registration-token.entity';
import { RegistrationTokenRepository } from './registration-token.repository';

describe('RegistrationTokenRepository', () => {
  const persistence = { findOne: jest.fn() };
  const manager = { getRepository: jest.fn().mockReturnValue(persistence) };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue({
      target: RegistrationTokenEntity,
      manager,
    }),
  };
  let repository: RegistrationTokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.getRepository.mockReturnValue(persistence);
    persistence.findOne.mockResolvedValue(null);
    repository = new RegistrationTokenRepository(dataSource as never);
  });

  it('returns the newest unconsumed registration for an email', async () => {
    await expect(
      repository.findPendingByEmail(manager as never, 'pending@example.test'),
    ).resolves.toBeNull();

    expect(manager.getRepository).toHaveBeenCalledWith(RegistrationTokenEntity);
    expect(persistence.findOne).toHaveBeenCalledWith({
      where: {
        email: 'pending@example.test',
        consumed_at: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
  });

  it('finds only an unconsumed registration token by id', async () => {
    await repository.findPendingById(manager as never, 'registration-1');

    expect(persistence.findOne).toHaveBeenCalledWith({
      where: { id: 'registration-1', consumed_at: IsNull() },
    });
  });

  it('exposes reads but no persistence mutation API', () => {
    expect(repository).not.toHaveProperty('save');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('delete');
    expect(repository).not.toHaveProperty('remove');
  });
});
