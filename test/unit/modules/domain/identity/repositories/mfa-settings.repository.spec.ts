import { UserMfaSettingsEntity } from '@/modules/domain/identity/entities/mfa.entity';
import { MfaSettingsRepository } from '@/modules/domain/identity/repositories/mfa-settings.repository';

describe('MfaSettingsRepository', () => {
  const persistence = { findOne: jest.fn() };
  const manager = { getRepository: jest.fn().mockReturnValue(persistence) };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue({
      target: UserMfaSettingsEntity,
      manager,
    }),
  };
  let repository: MfaSettingsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.getRepository.mockReturnValue(persistence);
    persistence.findOne.mockResolvedValue(null);
    repository = new MfaSettingsRepository(dataSource as never);
  });

  it.each([
    ['regardless of state', undefined, { user: { id: 'user-1' } }],
    ['when enabled', true, { user: { id: 'user-1' }, enabled: true }],
    ['when disabled', false, { user: { id: 'user-1' }, enabled: false }],
  ])('finds user MFA settings %s', async (_case, enabled, where) => {
    await expect(
      repository.findByUser(manager as never, 'user-1', enabled),
    ).resolves.toBeNull();

    expect(manager.getRepository).toHaveBeenCalledWith(UserMfaSettingsEntity);
    expect(persistence.findOne).toHaveBeenCalledWith({ where });
  });
});
