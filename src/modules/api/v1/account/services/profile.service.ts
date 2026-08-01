import {
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager } from 'typeorm';

import { AddressEntity } from '@/common/entities/address.entity';
import { PhoneEntity } from '@/common/entities/phone.entity';
import { IdentityAuditEvents } from '@/config/audit-events.config';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { UserAddressEntity } from '@/modules/domain/identity/entities/address.entity';
import { UserPhoneEntity } from '@/modules/domain/identity/entities/phone.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserDto } from '@/modules/domain/identity/models/user.model';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';
import { RegionRepository } from '@/modules/domain/library/repositories/region.repository';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import {
  CreateImageInput,
  ImageService,
} from '@/modules/domain/media/services/image.service';
import { UpdateAddressDto } from '../models/updateAddress.model';
import { UpdatePhoneDto } from '../models/updatePhone.model';
import {
  UpdateProfileCountryDto,
  UpdateProfileDto,
  UpdateProfileTimezoneDto,
} from '../models/updateProfile.model';

@Injectable()
export class ProfileApiService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly imgSvc: ImageService,
    private readonly regionRepo: RegionRepository,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  public async updateProfile(
    user: UserEntity,
    session: UserSessionEntity,
    dto: UpdateProfileDto,
  ): Promise<UserDto> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockUser(manager, user.id);
      const after = await this.userSvc.updateUser(
        current,
        {
          profile: {
            name: {
              first: dto.first_name,
              last: dto.last_name,
              preferred: dto.preferred_name,
            },
            personal: {
              dob: dto.dob,
              gender: { id: dto.gender_id },
              bio: dto.bio,
            },
          },
        },
        {},
        manager,
      );
      await this.record(
        manager,
        IdentityAuditEvents.PROFILE_NAME_CHANGED,
        AuditResourceType.IDENTITY_PROFILE,
        current.profile.id,
        this.profileName(current),
        this.profileName(after),
        user.id,
      );
      await this.record(
        manager,
        IdentityAuditEvents.PROFILE_PERSONAL_INFORMATION_CHANGED,
        AuditResourceType.IDENTITY_PROFILE,
        current.profile.id,
        this.profilePersonal(current),
        this.profilePersonal(after),
        user.id,
      );
      return after;
    });
    return new UserDto(updated, session);
  }

  public async updateCountry(
    user: UserEntity,
    session: UserSessionEntity,
    dto: UpdateProfileCountryDto,
  ): Promise<UserDto> {
    return this.updateProfileRegion(
      user,
      session,
      IdentityAuditEvents.PROFILE_COUNTRY_CHANGED,
      { profile: { region: { country: { id: dto.country_id } } } },
      'country_id',
    );
  }

  public async updateTimezone(
    user: UserEntity,
    session: UserSessionEntity,
    dto: UpdateProfileTimezoneDto,
  ): Promise<UserDto> {
    return this.updateProfileRegion(
      user,
      session,
      IdentityAuditEvents.PROFILE_TIMEZONE_CHANGED,
      { profile: { region: { timezone: { id: dto.timezone_id } } } },
      'timezone_id',
    );
  }

  public async uploadAvatar(
    user: UserEntity,
    session: UserSessionEntity,
    file: Express.Multer.File,
  ): Promise<UserDto> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockUser(manager, user.id);
      const existing = current.profile.media.avatar ?? null;
      const metadata: CreateImageInput = {
        file,
        alt_text: `Profile avatar for user id#${user.id}`,
        folder: 'users/avatars',
      };
      const image = existing
        ? await this.imgSvc.update({ ...metadata, image: existing }, manager)
        : await this.imgSvc.create(metadata, manager);
      const after = await this.userSvc.updateUser(
        current,
        {
          profile: { media: { avatar: { id: image.id } } },
        },
        {},
        manager,
      );
      await this.record(
        manager,
        existing
          ? IdentityAuditEvents.PROFILE_AVATAR_REPLACED
          : IdentityAuditEvents.PROFILE_AVATAR_ASSIGNED,
        AuditResourceType.IDENTITY_IMAGE,
        image.id,
        this.imageDocument(existing),
        this.imageDocument(image),
        user.id,
        true,
      );
      return after;
    });
    return new UserDto(updated, session);
  }

  public async removeAvatar(
    user: UserEntity,
    session: UserSessionEntity,
  ): Promise<UserDto> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockUser(manager, user.id);
      const avatar = current.profile.media.avatar;
      if (!avatar)
        throw new BadRequestException(
          'User does not have an avatar to remove.',
        );
      await this.userSvc.clearProfileAvatar(current.profile.id, manager);
      await this.imgSvc.remove(avatar, manager);
      await this.record(
        manager,
        IdentityAuditEvents.PROFILE_AVATAR_REMOVED,
        AuditResourceType.IDENTITY_IMAGE,
        avatar.id,
        this.imageDocument(avatar),
        null,
        user.id,
        true,
      );
      return manager.findOneOrFail(UserEntity, { where: { id: user.id } });
    });
    return new UserDto(updated, session);
  }

  public async updateAddress(
    user: UserEntity,
    session: UserSessionEntity,
    dto: UpdateAddressDto,
  ): Promise<UserDto> {
    const region: RegionEntity | null =
      await this.regionRepo.findByIdAndCountry(dto.region_id, dto.country_id);
    if (!region)
      throw new BadRequestException(
        'Region must belong to the selected country.',
      );
    const updated = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockUser(manager, user.id);
      const address = current.profile.contact.address;
      const payload: DeepPartial<AddressEntity> = {
        ...(address ? { id: address.id } : {}),
        address_line_1: dto.address_line_1,
        address_line_2: dto.address_line_2 ?? null,
        city: dto.city,
        region: { id: dto.region_id },
        postal_code: dto.postal_code,
        country: { id: dto.country_id },
      };
      const after = await this.userSvc.updateUser(
        current,
        { profile: { contact: { address: payload } } },
        {},
        manager,
      );
      const result = after.profile.contact.address!;
      await this.record(
        manager,
        address
          ? IdentityAuditEvents.PROFILE_ADDRESS_UPDATED
          : IdentityAuditEvents.PROFILE_ADDRESS_CREATED,
        AuditResourceType.IDENTITY_ADDRESS,
        result.id,
        this.addressDocument(address),
        this.addressDocument(result),
        user.id,
        true,
      );
      return after;
    });
    return new UserDto(updated, session);
  }

  public async removeAddress(
    user: UserEntity,
    session: UserSessionEntity,
  ): Promise<UserDto> {
    return this.removeContact(user, session, 'address');
  }

  public async updatePhone(
    user: UserEntity,
    session: UserSessionEntity,
    dto: UpdatePhoneDto,
  ): Promise<UserDto> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockUser(manager, user.id);
      const phone = current.profile.contact.phone;
      const after = await this.userSvc.updateUser(
        current,
        {
          profile: { contact: { phone: this.getPhonePayload(dto, phone) } },
        },
        {},
        manager,
      );
      const result = after.profile.contact.phone!;
      await this.record(
        manager,
        phone
          ? IdentityAuditEvents.PROFILE_PHONE_UPDATED
          : IdentityAuditEvents.PROFILE_PHONE_CREATED,
        AuditResourceType.IDENTITY_PHONE,
        result.id,
        this.phoneDocument(phone),
        this.phoneDocument(result),
        user.id,
        true,
      );
      return after;
    });
    return new UserDto(updated, session);
  }

  public async removePhone(
    user: UserEntity,
    session: UserSessionEntity,
  ): Promise<UserDto> {
    return this.removeContact(user, session, 'phone');
  }

  private async updateProfileRegion(
    user: UserEntity,
    session: UserSessionEntity,
    event: IdentityAuditEvents,
    payload: DeepPartial<UserEntity>,
    field: 'country_id' | 'timezone_id',
  ): Promise<UserDto> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockUser(manager, user.id);
      const after = await this.userSvc.updateUser(
        current,
        payload,
        {},
        manager,
      );
      const value = (entity: UserEntity) =>
        field === 'country_id'
          ? entity.profile.region.country.id
          : entity.profile.region.timezone.id;
      await this.record(
        manager,
        event,
        AuditResourceType.IDENTITY_PROFILE,
        current.profile.id,
        { id: current.profile.id, [field]: value(current) },
        { id: after.profile.id, [field]: value(after) },
        user.id,
      );

      return after;
    });

    return new UserDto(updated, session);
  }

  private async removeContact(
    user: UserEntity,
    session: UserSessionEntity,
    kind: 'phone' | 'address',
  ): Promise<UserDto> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockUser(manager, user.id);
      const contact = current.profile.contact[kind];

      if (!contact)
        throw new BadRequestException(
          `User does not have an ${kind === 'address' ? 'address' : 'phone'} to remove.`,
        );

      if (kind === 'address')
        await this.userSvc.deleteAddress(contact as UserAddressEntity, manager);
      else await this.userSvc.deletePhone(contact as UserPhoneEntity, manager);

      await this.record(
        manager,
        kind === 'address'
          ? IdentityAuditEvents.PROFILE_ADDRESS_REMOVED
          : IdentityAuditEvents.PROFILE_PHONE_REMOVED,
        kind === 'address'
          ? AuditResourceType.IDENTITY_ADDRESS
          : AuditResourceType.IDENTITY_PHONE,
        contact.id,
        kind === 'address'
          ? this.addressDocument(contact as UserAddressEntity)
          : this.phoneDocument(contact as UserPhoneEntity),
        null,
        user.id,
        true,
      );

      return manager.findOneOrFail(UserEntity, { where: { id: user.id } });
    });

    return new UserDto(updated, session);
  }

  private lockUser(manager: EntityManager, id: string): Promise<UserEntity> {
    return manager.findOneOrFail(UserEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private record(
    manager: EntityManager,
    event: IdentityAuditEvents,
    resourceType: AuditResourceType,
    resourceId: string,
    before: unknown,
    after: unknown,
    userId: string,
    meaningfulWithoutChanges = false,
  ) {
    return this.audit.record(
      {
        domain: 'identity',
        event,
        outcome: 'succeeded',
        actorType: 'user',
        actorId: userId,
        subjectType: AuditSubjectType.USER,
        subjectId: userId,
        resourceType,
        resourceId,
        source: 'http',
        metadata: {},
        before,
        after,
        meaningfulWithoutChanges,
      },
      manager,
    );
  }

  private profileName(user: UserEntity) {
    return {
      id: user.profile.id,
      first_name: user.profile.name.first,
      last_name: user.profile.name.last,
      preferred_name: user.profile.name.preferred,
    };
  }

  private profilePersonal(user: UserEntity) {
    return {
      id: user.profile.id,
      biography: user.profile.personal.bio,
      date_of_birth: user.profile.personal.dob,
      gender_id: user.profile.personal.gender.id,
    };
  }

  private phoneDocument(phone: UserPhoneEntity | null) {
    return (
      phone && {
        id: phone.id,
        country_id: phone.country.id,
        calling_code: phone.phone_calling_code,
        national_number: phone.phone_national_number,
        e164: phone.phone_e164,
      }
    );
  }

  private addressDocument(address: UserAddressEntity | null) {
    return (
      address && {
        id: address.id,
        address_line_1: address.address_line_1,
        address_line_2: address.address_line_2,
        city: address.city,
        region_id: address.region.id,
        postal_code: address.postal_code,
        country_id: address.country.id,
      }
    );
  }

  private imageDocument(image: ImageEntity | null) {
    return (
      image && {
        id: image.id,
        filename: image.filename,
        mime_type: image.mime_type,
        size_bytes: image.size_bytes,
        width: image.width,
        height: image.height,
      }
    );
  }

  private getPhonePayload(
    dto: UpdatePhoneDto,
    phone: PhoneEntity | null,
  ): DeepPartial<PhoneEntity> {
    return {
      ...(phone ? { id: phone.id } : {}),
      country: { id: dto.phone_country_id },
      phone_calling_code: dto.phone_calling_code,
      phone_national_number: dto.phone_national_number,
      phone_e164: dto.phone_e164,
    };
  }
}
