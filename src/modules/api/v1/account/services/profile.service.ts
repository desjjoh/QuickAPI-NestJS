import { Response } from 'express';

import { BadRequestException, Injectable } from '@nestjs/common';

import { IdentityService } from '@/modules/domain/identity/services/identity.service';
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

@Injectable()
export class ProfileApiService {
  public constructor(
    private readonly userSvc: IdentityService,
    private readonly imgSvc: ImageService,
  ) {}

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

    return this.userSvc.issueTokens(updated, res);
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

    return this.userSvc.issueTokens(updated, res);
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

    return this.userSvc.issueTokens(updated, res);
  }

  public async removeAddress(user: UserEntity, res: Response): Promise<JWTDto> {
    const address: UserAddressEntity | null = user.profile.contact.address;

    if (!address)
      throw new BadRequestException('User does not have an address to remove.');

    const updated = await this.userSvc.updateUser(user, {
      profile: { contact: { address: null } },
    });

    await this.userSvc.deleteAddress(address);

    return this.userSvc.issueTokens(updated, res);
  }
}
