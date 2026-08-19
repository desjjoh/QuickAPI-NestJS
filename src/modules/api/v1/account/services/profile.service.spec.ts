jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AuditService } from '@/modules/domain/audit/services/audit.service';
import type { ImageService } from '@/modules/domain/media/services/image.service';
import type { RegionRepository } from '@/modules/domain/library/repositories/region.repository';
import type { UserService } from '@/modules/domain/identity/services/user.service';
import { IdentityAuditEvents } from '@/config/audit-events.config';
import {
  sessionFixture,
  userFixture,
} from '@/../test/helpers/identity.fixtures';
import { ProfileApiService } from './profile.service';

describe('ProfileApiService audit mutations', () => {
  const session = sessionFixture();

  const setup = (current = userFixture(), after = current) => {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue(current),
    };
    const dataSource = {
      transaction: jest.fn((work) => work(manager)),
    };
    const userSvc = {
      updateUser: jest.fn().mockResolvedValue(after),
      clearProfileAvatar: jest.fn(),
      deleteAddress: jest.fn(),
      deletePhone: jest.fn(),
    };
    const imgSvc = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    const regionRepo = {
      findByIdAndCountry: jest.fn().mockResolvedValue({ id: 'region-1' }),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    return {
      service: new ProfileApiService(
        userSvc as unknown as UserService,
        imgSvc as unknown as ImageService,
        regionRepo as unknown as RegionRepository,
        dataSource as unknown as DataSource,
        audit as unknown as AuditService,
      ),
      manager,
      dataSource,
      userSvc,
      imgSvc,
      regionRepo,
      audit,
    };
  };

  it('records separate name and personal-information events in the mutation transaction', async () => {
    const current = userFixture();
    const after = userFixture({
      profile: {
        ...current.profile,
        name: { first: 'New', last: 'Name', preferred: 'N' },
        personal: {
          ...current.profile.personal,
          bio: 'Bio',
          dob: '1991-02-03',
          gender: { id: 'gender-2' },
        },
      },
    });
    const { service, audit, manager, dataSource, userSvc } = setup(
      current,
      after,
    );
    userSvc.updateUser.mockImplementation(async () => {
      Object.assign(current.profile.name, after.profile.name);
      Object.assign(current.profile.personal, after.profile.personal);
      return after;
    });
    await service.updateProfile(current, session, {
      first_name: 'New',
      last_name: 'Name',
      preferred_name: 'N',
      bio: 'Bio',
      dob: '1991-02-03',
      gender_id: 'gender-2',
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'identity',
        event: IdentityAuditEvents.PROFILE_NAME_CHANGED,
        actorType: 'user',
        actorId: current.id,
        subjectId: current.id,
        resourceType: 'identity.profile',
        before: expect.any(Object),
        after: expect.any(Object),
      }),
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: IdentityAuditEvents.PROFILE_PERSONAL_INFORMATION_CHANGED,
        before: expect.objectContaining({ date_of_birth: '1990-01-01' }),
        after: expect.objectContaining({ date_of_birth: '1991-02-03' }),
      }),
      manager,
    );
  });

  it('distinguishes phone creation and supplies explicit safe documents', async () => {
    const current = userFixture();
    const phone = {
      id: 'phone-1',
      country: { id: 'country-1' },
      phone_calling_code: '+1',
      phone_national_number: '6135550100',
      phone_e164: '+16135550100',
    };
    const after = userFixture({
      profile: {
        ...current.profile,
        contact: { ...current.profile.contact, phone },
      },
    });
    const { service, audit, manager } = setup(current, after);
    await service.updatePhone(current, session, {
      phone_country_id: 'country-1',
      phone_calling_code: '+1',
      phone_national_number: '6135550100',
      phone_e164: '+16135550100',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: IdentityAuditEvents.PROFILE_PHONE_CREATED,
        resourceType: 'identity.phone',
        resourceId: 'phone-1',
        before: null,
        after: {
          id: 'phone-1',
          country_id: 'country-1',
          calling_code: '+1',
          national_number: '6135550100',
          e164: '+16135550100',
        },
      }),
      manager,
    );
  });

  it('records address removal with the owning user as subject', async () => {
    const address = {
      id: 'address-1',
      address_line_1: '1 Main',
      address_line_2: null,
      city: 'Ottawa',
      region: { id: 'region-1' },
      postal_code: 'K1A0B1',
      country: { id: 'country-1' },
    };
    const current = userFixture({
      profile: { ...userFixture().profile, contact: { phone: null, address } },
    });
    const { service, audit, manager, userSvc } = setup(current);
    await service.removeAddress(current, session);
    expect(userSvc.deleteAddress).toHaveBeenCalledWith(address, manager);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: IdentityAuditEvents.PROFILE_ADDRESS_REMOVED,
        subjectId: current.id,
        resourceType: 'identity.address',
        resourceId: 'address-1',
        after: null,
      }),
      manager,
    );
  });

  it('rejects removing a missing phone without writing an audit event', async () => {
    const current = userFixture();
    const { service, audit } = setup(current);
    await expect(service.removePhone(current, session)).rejects.toThrow(
      BadRequestException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it.each([
    [
      'country',
      (service: ProfileApiService, user: ReturnType<typeof userFixture>) =>
        service.updateCountry(user, session, { country_id: 'country-2' }),
      IdentityAuditEvents.PROFILE_COUNTRY_CHANGED,
      'country_id',
      'country-2',
    ],
    [
      'timezone',
      (service: ProfileApiService, user: ReturnType<typeof userFixture>) =>
        service.updateTimezone(user, session, { timezone_id: 'timezone-2' }),
      IdentityAuditEvents.PROFILE_TIMEZONE_CHANGED,
      'timezone_id',
      'timezone-2',
    ],
  ])(
    'records a %s update with the changed region value',
    async (_label, update, event, field, value) => {
      const current = userFixture();
      const after = userFixture({
        profile: {
          ...current.profile,
          region: {
            country:
              field === 'country_id'
                ? { id: value }
                : current.profile.region.country,
            timezone:
              field === 'timezone_id'
                ? { id: value }
                : current.profile.region.timezone,
          },
        },
      });
      const { service, audit, manager } = setup(current, after);

      await update(service, current);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event,
          before: expect.objectContaining({ [field]: expect.any(String) }),
          after: expect.objectContaining({ [field]: value }),
        }),
        manager,
      );
    },
  );

  it.each([false, true])(
    '%s existing avatar selects the correct image mutation and audit event',
    async (hasAvatar) => {
      const base = userFixture();
      const existing = hasAvatar
        ? {
            id: 'avatar-old',
            storage_key: 'avatars/old.png',
            filename: 'old.png',
            mime_type: 'image/png',
            size_bytes: 100,
            width: 10,
            height: 10,
          }
        : null;
      const current = userFixture({
        profile: {
          ...base.profile,
          media: { ...base.profile.media, avatar: existing },
        },
      });
      const image = {
        id: 'avatar-new',
        storage_key: 'avatars/new.png',
        filename: 'new.png',
        mime_type: 'image/png',
        size_bytes: 200,
        width: 20,
        height: 20,
      };
      const after = userFixture({
        profile: {
          ...current.profile,
          media: { ...current.profile.media, avatar: image },
        },
      });
      const { service, imgSvc, audit, manager } = setup(current, after);
      imgSvc.create.mockResolvedValue(image);
      imgSvc.update.mockResolvedValue(image);
      const file = { originalname: 'new.png' } as Express.Multer.File;

      await service.uploadAvatar(current, session, file);

      expect(hasAvatar ? imgSvc.update : imgSvc.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: hasAvatar
            ? IdentityAuditEvents.PROFILE_AVATAR_REPLACED
            : IdentityAuditEvents.PROFILE_AVATAR_ASSIGNED,
          before: hasAvatar
            ? expect.objectContaining({ id: 'avatar-old' })
            : null,
          after: expect.objectContaining({ id: 'avatar-new' }),
        }),
        manager,
      );
    },
  );

  it('creates an address without an optional second line', async () => {
    const current = userFixture();
    const address = {
      id: 'address-new',
      address_line_1: '2 Main',
      address_line_2: null,
      city: 'Toronto',
      region: { id: 'region-2' },
      postal_code: 'M5V1A1',
      country: { id: 'country-2' },
    };
    const after = userFixture({
      profile: {
        ...current.profile,
        contact: { ...current.profile.contact, address },
      },
    });
    const { service, userSvc, audit, manager } = setup(current, after);

    await service.updateAddress(current, session, {
      address_line_1: address.address_line_1,
      city: address.city,
      region_id: address.region.id,
      postal_code: address.postal_code,
      country_id: address.country.id,
    });

    expect(userSvc.updateUser).toHaveBeenCalledWith(
      current,
      expect.objectContaining({
        profile: expect.objectContaining({
          contact: expect.objectContaining({
            address: expect.objectContaining({ address_line_2: null }),
          }),
        }),
      }),
      {},
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: IdentityAuditEvents.PROFILE_ADDRESS_CREATED,
        before: null,
      }),
      manager,
    );
  });

  it('rejects an address whose region does not belong to its country', async () => {
    const current = userFixture();
    const { service, regionRepo, dataSource } = setup(current);
    regionRepo.findByIdAndCountry.mockResolvedValue(null);

    await expect(
      service.updateAddress(current, session, {
        address_line_1: '2 Main',
        address_line_2: 'Unit 1',
        city: 'Toronto',
        region_id: 'region-2',
        postal_code: 'M5V1A1',
        country_id: 'country-2',
      }),
    ).rejects.toThrow('Region must belong to the selected country.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('removes an existing phone and records its safe document', async () => {
    const base = userFixture();
    const phone = {
      id: 'phone-1',
      country: { id: 'country-1' },
      phone_calling_code: '+1',
      phone_national_number: '6135550100',
      phone_e164: '+16135550100',
    };
    const current = userFixture({
      profile: {
        ...base.profile,
        contact: { ...base.profile.contact, phone },
      },
    });
    const { service, userSvc, audit, manager } = setup(current);

    await service.removePhone(current, session);

    expect(userSvc.deletePhone).toHaveBeenCalledWith(phone, manager);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: IdentityAuditEvents.PROFILE_PHONE_REMOVED,
        before: expect.objectContaining({ id: phone.id }),
      }),
      manager,
    );
  });
});
