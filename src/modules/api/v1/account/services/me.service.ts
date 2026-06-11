import { Response } from 'express';

import { BadRequestException, Injectable } from '@nestjs/common';

import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

import { UpdateEmailDto } from '../models/updateEmail.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';
import { UpdatePhoneDto } from '../models/updatePhone.model';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import { PhoneEntity } from '@/common/entities/phone.entity';
import { UserPhoneEntity } from '@/modules/domain/identity/entities/phone.entity';
import { DeepPartial } from 'typeorm';

@Injectable()
export class MeApiService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly evSvc: EmailVerificationService,
  ) {}

  public async deleteMe(
    user: UserEntity,
    dto: DeleteAccountDto,
    res: Response,
  ): Promise<void> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    await this.userSvc.deleteUser(user, res);
  }

  public async updateEmail(
    user: UserEntity,
    dto: UpdateEmailDto,
  ): Promise<void> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    await this.evSvc.sendEmailChangeVerification(user, dto.confirm);
  }

  public async updatePhone(
    user: UserEntity,
    dto: UpdatePhoneDto,
    res: Response,
  ): Promise<JWTDto> {
    const phone: UserPhoneEntity | null = user.identity.phone;
    const payload = this.getPhonePayload(dto, phone);

    const updated = await this.userSvc.updateUser(user, {
      identity: { phone: payload },
    });

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async removePhone(user: UserEntity, res: Response): Promise<JWTDto> {
    const phone: UserPhoneEntity | null = user.identity.phone;

    if (!phone)
      throw new BadRequestException('User does not have a phone to remove.');

    const updated = await this.userSvc.updateUser(user, {
      identity: { phone: null },
    });

    await this.userSvc.deletePhone(phone);

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

  public async updatePassword(
    user: UserEntity,
    dto: UpdatePasswordDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    const hashed = await this.userSvc.hashPassword(dto.confirm);
    const updated = await this.userSvc.updateUser(user, {
      identity: { password: hashed },
    });

    return this.refreshSvc.issueTokens(updated, res);
  }
}
