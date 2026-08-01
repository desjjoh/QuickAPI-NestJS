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
    const { service, audit, manager, dataSource } = setup(current, after);
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
});
