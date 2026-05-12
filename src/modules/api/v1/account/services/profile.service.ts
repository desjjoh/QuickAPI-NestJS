import { Response } from 'express';

import { BadRequestException, Injectable } from '@nestjs/common';

import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  CreateImageInput,
  ImageService,
} from '@/modules/domain/library/services/image.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { ImageEntity } from '@/modules/domain/library/entities/image.entity';
import { UserAddressEntity } from '@/modules/domain/identity/entities/address.entity';
import { UpdateAddressDto } from '../models/updateAddress.model';
import { AddressEntity } from '@/common/entities/address.entity';
import { DeepPartial } from 'typeorm';
import { UpdateProfileDto } from '../models/updateProfile.model';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';

@Injectable()
export class ProfileApiService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly imgSvc: ImageService,
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
        },
        personal: {
          dob: dto.dob,
          gender: { id: dto.gender_id },
        },
        contact: {
          alternate_phone_e164: dto.alternate_phone_e164,
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
    const existingAvatar: ImageEntity | null = user.profile?.avatar ?? null;
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
      profile: { avatar: { id: image.id } },
    });

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async removeAvatar(user: UserEntity, res: Response): Promise<JWTDto> {
    const avatar: ImageEntity | null = user.profile.avatar;

    if (!avatar)
      throw new BadRequestException('User does not have an avatar to remove.');

    const updated = await this.userSvc.updateUser(user, {
      profile: {
        avatar: null,
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

    const payload: DeepPartial<AddressEntity> = {
      ...(address ? { id: address.id } : {}),
      address_line_1: dto.address_line_1,
      address_line_2: dto.address_line_2 ?? null,
      city: dto.city,
      region: dto.region,
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
}
