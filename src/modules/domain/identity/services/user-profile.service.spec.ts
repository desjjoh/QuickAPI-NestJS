import { UserAddressEntity } from '../entities/address.entity';
import { UserPhoneEntity } from '../entities/phone.entity';
import { UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
  const manager = { delete: jest.fn(), query: jest.fn() };
  const repository = { manager };
  let service: UserProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserProfileService(repository as never);
  });

  it('deletes an address by id through the selected manager', async () => {
    await service.deleteAddress({ id: 'address-1' } as never, manager as never);

    expect(manager.delete).toHaveBeenCalledWith(UserAddressEntity, {
      id: 'address-1',
    });
  });

  it('deletes a phone by id through the selected manager', async () => {
    await service.deletePhone({ id: 'phone-1' } as never, manager as never);

    expect(manager.delete).toHaveBeenCalledWith(UserPhoneEntity, {
      id: 'phone-1',
    });
  });

  it('clears only the requested profile avatar relation', async () => {
    await service.clearAvatar('profile-1', manager as never);

    expect(manager.query).toHaveBeenCalledWith(
      'UPDATE `user_profiles` SET `avatar_id` = NULL WHERE `id` = ?',
      ['profile-1'],
    );
  });
});
