import { Response } from 'express';

import { BadRequestException, Injectable } from '@nestjs/common';

import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserAddressEntity } from '@/modules/domain/identity/entities/address.entity';
import { UpdateAddressDto } from '../models/updateAddress.model';
import { AddressEntity } from '@/common/entities/address.entity';
import { DeepPartial } from 'typeorm';
import { UpdateProfileDto } from '../models/updateProfile.model';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import {
  CreateImageInput,
  ImageService,
} from '@/modules/domain/media/services/image.service';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import {
  UserAlternatePhoneEntity,
  UserPhoneEntity,
} from '@/modules/domain/identity/entities/phone.entity';
import { UpdatePhoneDto } from '../models/updatePhone.model';
import { PhoneEntity } from '@/common/entities/phone.entity';
import { RegionRepository } from '@/modules/domain/library/repositories/region.repository';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';

@Injectable()
export class ProfileApiService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly imgSvc: ImageService,
    private readonly regionRepo: RegionRepository,
  ) {}

  public async updateProfile(
    user: UserEntity,
    dto: UpdateProfileDto,
    res: Response,
  ): Promise<JWTDto> {
    const updated = await this.userSvc.updateUser(user, {
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
    });

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async uploadAvatar(
    user: UserEntity,
    file: Express.Multer.File,
    res: Response,
  ): Promise<JWTDto> {
    const existingAvatar: ImageEntity | null =
      user.profile.media.avatar ?? null;

    const metadata: CreateImageInput = {
      file,
      alt_text: `Profile avatar for user id#${user.id}`,
      folder: 'users/avatars',
    };

    const image: ImageEntity = existingAvatar
      ? await this.imgSvc.update({
          ...metadata,
          image: existingAvatar,
        })
      : await this.imgSvc.create(metadata);

    const updated: UserEntity = await this.userSvc.updateUser(user, {
      profile: { media: { avatar: { id: image.id } } },
    });

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async removeAvatar(user: UserEntity, res: Response): Promise<JWTDto> {
    const avatar: ImageEntity | null = user.profile.media.avatar;

    if (!avatar)
      throw new BadRequestException('User does not have an avatar to remove.');

    const updated = await this.userSvc.updateUser(user, {
      profile: {
        media: {
          avatar: null,
        },
      },
    });

    await this.imgSvc.remove(avatar);

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async updateAddress(
    user: UserEntity,
    dto: UpdateAddressDto,
    res: Response,
  ): Promise<JWTDto> {
    const address: UserAddressEntity | null = user.profile.contact.address;
    const region: RegionEntity | null =
      await this.regionRepo.findByIdAndCountry(dto.region_id, dto.country_id);

    if (!region)
      throw new BadRequestException(
        'Region must belong to the selected country.',
      );

    const payload: DeepPartial<AddressEntity> = {
      ...(address ? { id: address.id } : {}),
      address_line_1: dto.address_line_1,
      address_line_2: dto.address_line_2 ?? null,
      city: dto.city,
      region: { id: dto.region_id },
      postal_code: dto.postal_code,
      country: { id: dto.country_id },
    };

    const updated = await this.userSvc.updateUser(user, {
      profile: { contact: { address: payload } },
    });

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async removeAddress(user: UserEntity, res: Response): Promise<JWTDto> {
    const address: UserAddressEntity | null = user.profile.contact.address;

    if (!address)
      throw new BadRequestException('User does not have an address to remove.');

    const updated = await this.userSvc.updateUser(user, {
      profile: { contact: { address: null } },
    });

    await this.userSvc.deleteAddress(address);

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async updatePhone(
    user: UserEntity,
    dto: UpdatePhoneDto,
    res: Response,
  ): Promise<JWTDto> {
    const phone: UserPhoneEntity | null = user.profile.contact.phone;
    const payload = this.getPhonePayload(dto, phone);

    const updated = await this.userSvc.updateUser(user, {
      profile: { contact: { phone: payload } },
    });

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async removePhone(user: UserEntity, res: Response): Promise<JWTDto> {
    const phone: UserPhoneEntity | null = user.profile.contact.phone;

    if (!phone)
      throw new BadRequestException('User does not have a phone to remove.');

    const updated = await this.userSvc.updateUser(user, {
      profile: { contact: { phone: null } },
    });

    await this.userSvc.deletePhone(phone);

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async updateAlternatePhone(
    user: UserEntity,
    dto: UpdatePhoneDto,
    res: Response,
  ): Promise<JWTDto> {
    const phone: UserAlternatePhoneEntity | null =
      user.profile.contact.alternate_phone;
    const payload = this.getPhonePayload(dto, phone);

    const updated = await this.userSvc.updateUser(user, {
      profile: { contact: { alternate_phone: payload } },
    });

    return this.refreshSvc.issueTokens(updated, res);
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

  public async removeAlternatePhone(
    user: UserEntity,
    res: Response,
  ): Promise<JWTDto> {
    const phone: UserAlternatePhoneEntity | null =
      user.profile.contact.alternate_phone;

    if (!phone)
      throw new BadRequestException(
        'User does not have an alternate phone to remove.',
      );

    const updated = await this.userSvc.updateUser(user, {
      profile: { contact: { alternate_phone: null } },
    });

    await this.userSvc.deletePhone(phone);

    return this.refreshSvc.issueTokens(updated, res);
  }
}
