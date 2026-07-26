jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException } from '@nestjs/common';
import type { ImageService } from '@/modules/domain/media/services/image.service';
import type { RegionRepository } from '@/modules/domain/library/repositories/region.repository';
import type { UserService } from '@/modules/domain/identity/services/user.service';
import { UserDto } from '@/modules/domain/identity/models/user.model';
import {
  sessionFixture,
  userFixture,
} from '@/../test/helpers/identity.fixtures';
import { ProfileApiService } from './profile.service';

describe('ProfileApiService', () => {
  const session = sessionFixture();
  const user = userFixture();
  const setup = () => {
    const userSvc = {
      updateUser: jest.fn().mockResolvedValue(user),
      clearProfileAvatar: jest.fn(),
      deleteAddress: jest.fn(),
      deletePhone: jest.fn(),
      findByIdOrFail: jest.fn().mockResolvedValue(user),
      updateMetadata: jest.fn().mockResolvedValue(user),
    };
    const imgSvc = {
      create: jest.fn().mockResolvedValue({ id: 'image-new' }),
      update: jest.fn().mockResolvedValue({ id: 'image-new' }),
      remove: jest.fn(),
    };
    const regionRepo = {
      findByIdAndCountry: jest.fn().mockResolvedValue({ id: 'region-1' }),
    };
    return {
      service: new ProfileApiService(
        userSvc as unknown as UserService,
        imgSvc as unknown as ImageService,
        regionRepo as unknown as RegionRepository,
      ),
      userSvc,
      imgSvc,
      regionRepo,
    };
  };

  it('updates profile names and personal fields and returns a UserDto', async () => {
    const { service, userSvc } = setup();
    const dto = {
      first_name: 'New',
      last_name: 'Name',
      preferred_name: 'N',
      dob: '1991-02-03',
      gender_id: 'gender-2',
      bio: 'Bio',
    };
    const result = await service.updateProfile(user, session, dto);
    expect(result).toBeInstanceOf(UserDto);
    expect(userSvc.updateUser).toHaveBeenCalledWith(user, {
      profile: {
        name: { first: 'New', last: 'Name', preferred: 'N' },
        personal: { dob: '1991-02-03', gender: { id: 'gender-2' }, bio: 'Bio' },
      },
    });
  });

  it.each([
    [
      'country',
      'updateCountry',
      { country_id: 'country-2' },
      { profile: { region: { country: { id: 'country-2' } } } },
    ],
    [
      'timezone',
      'updateTimezone',
      { timezone_id: 'timezone-2' },
      { profile: { region: { timezone: { id: 'timezone-2' } } } },
    ],
  ] as const)(
    'updates the profile %s and returns a UserDto',
    async (_label, method, dto, payload) => {
      const { service, userSvc } = setup();
      const result = await service[method](user, session, dto as never);
      expect(result).toBeInstanceOf(UserDto);
      expect(userSvc.updateUser).toHaveBeenCalledWith(user, payload);
    },
  );

  it('creates an avatar and associates the stored image with the profile', async () => {
    const { service, userSvc, imgSvc } = setup();
    const file = { originalname: 'avatar.png' } as Express.Multer.File;
    await expect(
      service.uploadAvatar(user, session, file),
    ).resolves.toBeInstanceOf(UserDto);
    expect(imgSvc.create).toHaveBeenCalledWith({
      file,
      alt_text: `Profile avatar for user id#${user.id}`,
      folder: 'users/avatars',
    });
    expect(userSvc.updateUser).toHaveBeenCalledWith(user, {
      profile: { media: { avatar: { id: 'image-new' } } },
    });
  });

  it('replaces an existing avatar through storage without creating another image', async () => {
    const avatar = { id: 'old-image', storage_key: 'old.png' };
    const withAvatar = userFixture({
      profile: { ...user.profile, media: { avatar } },
    });
    const { service, imgSvc } = setup();
    const file = { originalname: 'new.png' } as Express.Multer.File;
    await service.uploadAvatar(withAvatar, session, file);
    expect(imgSvc.update).toHaveBeenCalledWith(
      expect.objectContaining({ file, image: avatar, folder: 'users/avatars' }),
    );
    expect(imgSvc.create).not.toHaveBeenCalled();
  });

  it('clears, deletes, and reloads an existing avatar', async () => {
    const avatar = { id: 'old-image', storage_key: 'old.png' };
    const withAvatar = userFixture({
      profile: { ...user.profile, media: { avatar } },
    });
    const { service, userSvc, imgSvc } = setup();
    await expect(
      service.removeAvatar(withAvatar, session),
    ).resolves.toBeInstanceOf(UserDto);
    expect(userSvc.clearProfileAvatar).toHaveBeenCalledWith(
      withAvatar.profile.id,
    );
    expect(imgSvc.remove).toHaveBeenCalledWith(avatar);
    expect(userSvc.findByIdOrFail).toHaveBeenCalledWith(withAvatar.id);
    expect(userSvc.updateMetadata).toHaveBeenCalledWith(user, {});
  });

  it('rejects avatar removal when none exists', async () => {
    const { service, imgSvc } = setup();
    await expect(service.removeAvatar(user, session)).rejects.toThrow(
      BadRequestException,
    );
    expect(imgSvc.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['creates', null, false],
    ['updates', { id: 'address-1' }, true],
  ])(
    '%s an address after checking its region and country',
    async (_label, address, hasId) => {
      const source = userFixture({
        profile: {
          ...user.profile,
          contact: { ...user.profile.contact, address },
        },
      });
      const { service, userSvc, regionRepo } = setup();
      const dto = {
        address_line_1: '1 Main',
        address_line_2: undefined,
        city: 'Ottawa',
        region_id: 'region-1',
        postal_code: 'K1A0B1',
        country_id: 'country-1',
      };
      await expect(
        service.updateAddress(source, session, dto),
      ).resolves.toBeInstanceOf(UserDto);
      expect(regionRepo.findByIdAndCountry).toHaveBeenCalledWith(
        'region-1',
        'country-1',
      );
      expect(userSvc.updateUser).toHaveBeenCalledWith(source, {
        profile: {
          contact: {
            address: {
              ...(hasId ? { id: 'address-1' } : {}),
              address_line_1: '1 Main',
              address_line_2: null,
              city: 'Ottawa',
              region: { id: 'region-1' },
              postal_code: 'K1A0B1',
              country: { id: 'country-1' },
            },
          },
        },
      });
    },
  );

  it('rejects an address whose region does not belong to its country', async () => {
    const { service, userSvc, regionRepo } = setup();
    regionRepo.findByIdAndCountry.mockResolvedValue(null);
    await expect(
      service.updateAddress(user, session, {
        address_line_1: '1 Main',
        city: 'X',
        region_id: 'bad',
        postal_code: '1',
        country_id: 'country-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(userSvc.updateUser).not.toHaveBeenCalled();
  });

  it('deletes an address and returns the reloaded DTO', async () => {
    const address = { id: 'address-1' };
    const source = userFixture({
      profile: {
        ...user.profile,
        contact: { ...user.profile.contact, address },
      },
    });
    const { service, userSvc } = setup();
    await expect(
      service.removeAddress(source, session),
    ).resolves.toBeInstanceOf(UserDto);
    expect(userSvc.deleteAddress).toHaveBeenCalledWith(address);
  });

  it.each([
    ['creates', null, false],
    ['updates', { id: 'phone-1' }, true],
  ])('%s a phone contact', async (_label, phone, hasId) => {
    const source = userFixture({
      profile: { ...user.profile, contact: { ...user.profile.contact, phone } },
    });
    const { service, userSvc } = setup();
    const dto = {
      phone_country_id: 'country-1',
      phone_calling_code: '+1',
      phone_national_number: '6135550100',
      phone_e164: '+16135550100',
    };
    await expect(
      service.updatePhone(source, session, dto),
    ).resolves.toBeInstanceOf(UserDto);
    expect(userSvc.updateUser).toHaveBeenCalledWith(source, {
      profile: {
        contact: {
          phone: {
            ...(hasId ? { id: 'phone-1' } : {}),
            country: { id: 'country-1' },
            phone_calling_code: '+1',
            phone_national_number: '6135550100',
            phone_e164: '+16135550100',
          },
        },
      },
    });
  });

  it('deletes a phone and returns the reloaded DTO', async () => {
    const phone = { id: 'phone-1' };
    const source = userFixture({
      profile: { ...user.profile, contact: { ...user.profile.contact, phone } },
    });
    const { service, userSvc } = setup();
    await expect(service.removePhone(source, session)).resolves.toBeInstanceOf(
      UserDto,
    );
    expect(userSvc.deletePhone).toHaveBeenCalledWith(phone);
  });

  it.each([
    ['address', 'removeAddress'],
    ['phone', 'removePhone'],
  ] as const)('rejects removing a missing %s', async (_label, method) => {
    const { service } = setup();
    await expect(service[method](user, session)).rejects.toThrow(
      BadRequestException,
    );
  });
});
