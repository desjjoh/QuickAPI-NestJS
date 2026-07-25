import {
  Controller,
  UseGuards,
  Delete,
  Put,
  UseInterceptors,
  UploadedFile,
  Body,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import { storage } from '@/config/storage.config';

import { UserDto } from '@/modules/domain/identity/models/user.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';

import { CsrfGuard } from '@/common/guards/csrf.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';
import {
  CurrentSession,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';
import { megabyte } from '@/common/constants/bytes.constants';
import { ApiFileUpload } from '@/common/decorators/file-upload.decorator';

import { ProfileApiService } from '../services/profile.service';
import { UpdateAddressDto } from '../models/updateAddress.model';
import {
  UpdateProfileCountryDto,
  UpdateProfileDto,
  UpdateProfileTimezoneDto,
} from '../models/updateProfile.model';
import { UpdatePhoneDto } from '../models/updatePhone.model';

@ApiTags('Profile Management')
@ApiBearerAuth('access-token')
@Controller('profile')
@UseGuards(CsrfGuard, JwtAuthGuard, PermissionsGuard)
export class ProfileApiController {
  public constructor(private readonly svc: ProfileApiService) {}

  // PATCH /
  @Patch('')
  @ApiBody({
    type: UpdateProfileDto,
    description:
      'Complete editable profile payload. All fields are required. Send null for nullable fields to clear them.',
  })
  @ApiOperation({
    summary: 'Update profile information',
    description:
      'Updates profile details for the authenticated account, such as name, date of birth, gender, or contact information.',
  })
  @ApiOkResponse({
    description:
      'Profile information updated successfully. Returns the updated authenticated user payload.',
    type: UserDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async updateProfile(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDto> {
    return this.svc.updateProfile(user, session, dto);
  }

  // PUT /country
  @Put('country')
  @ApiOperation({
    summary: 'Update profile country',
    description:
      'Updates the authenticated user’s required profile country using a country reference ID.',
  })
  @ApiBody({
    type: UpdateProfileCountryDto,
    description:
      'Country reference payload used to update the profile country.',
  })
  @ApiOkResponse({
    description:
      'Profile country updated successfully. Returns the updated authenticated user payload.',
    type: UserDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async updateCountry(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
    @Body() dto: UpdateProfileCountryDto,
  ): Promise<UserDto> {
    return this.svc.updateCountry(user, session, dto);
  }

  // PUT /timezone
  @Put('timezone')
  @ApiOperation({
    summary: 'Update profile timezone',
    description:
      'Updates the authenticated user’s profile timezone using a time zone reference key.',
  })
  @ApiBody({
    type: UpdateProfileTimezoneDto,
    description:
      'Time zone reference payload used to update the profile timezone.',
  })
  @ApiOkResponse({
    description:
      'Profile timezone updated successfully. Returns the updated authenticated user payload.',
    type: UserDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async updateTimezone(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
    @Body() dto: UpdateProfileTimezoneDto,
  ): Promise<UserDto> {
    return this.svc.updateTimezone(user, session, dto);
  }

  // POST /avatar
  @Post('avatar')
  @ApiOperation({
    summary: 'Set profile avatar',
    description:
      'Uploads and sets the authenticated user’s profile avatar. Replaces the existing avatar if one is already assigned.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiFileUpload({
    fieldName: 'avatar',
    description:
      'Image file to use as the authenticated user’s profile avatar. The file must pass image validation and size restrictions.',
  })
  @ApiOkResponse({
    description:
      'Profile avatar updated successfully. Returns the updated authenticated user payload.',
    type: UserDto,
  })
  @UseInterceptors(FileInterceptor('avatar', { storage }))
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async uploadAvatar(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
    @UploadedFile(
      new ImageUploadValidationPipe({
        maxSize: 1 * megabyte,
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ): Promise<UserDto> {
    return this.svc.uploadAvatar(user, session, file);
  }

  // DELETE /avatar
  @Delete('avatar')
  @ApiOperation({
    summary: 'Remove profile avatar',
    description:
      'Removes the authenticated user’s current profile avatar. The avatar relation is cleared, the associated image record is removed, and the stored image file is deleted. If no avatar exists, the request fails.',
  })
  @ApiOkResponse({
    description:
      'Profile avatar removed successfully. Returns the updated authenticated user payload.',
    type: UserDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async removeAvatar(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
  ): Promise<UserDto> {
    return this.svc.removeAvatar(user, session);
  }

  // POST /phone
  @Post('phone')
  @ApiOperation({
    summary: 'Set primary phone number',
    description:
      'Creates or updates the authenticated user’s primary phone number with full country and dialing details.',
  })
  @ApiOkResponse({
    description:
      'The primary phone number was created or updated successfully.',
    type: UserDto,
  })
  @ApiBody({
    type: UpdatePhoneDto,
    description:
      'Complete phone payload used to create or replace the authenticated user’s primary phone number.',
  })
  public async updatePrimaryPhone(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
    @Body() dto: UpdatePhoneDto,
  ): Promise<UserDto> {
    return this.svc.updatePhone(user, session, dto);
  }

  // DELETE /phone
  @Delete('phone')
  @ApiOperation({
    summary: 'Remove primary phone number',
    description:
      'Removes the authenticated user’s primary phone number record. If no primary phone exists, the request fails.',
  })
  @ApiOkResponse({
    description: 'The primary phone number was removed successfully.',
    type: UserDto,
  })
  public async removePrimaryPhone(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
  ): Promise<UserDto> {
    return this.svc.removePhone(user, session);
  }

  // POST /address
  @Post('address')
  @ApiOperation({
    summary: 'Set profile address',
    description:
      'Creates or updates the authenticated user’s profile address. If an address already exists, it is updated. If no address exists, a new address is created and assigned to the user profile.',
  })
  @ApiBody({
    type: UpdateAddressDto,
    description:
      'Complete address payload used to create or replace the authenticated user’s profile address.',
  })
  @ApiOkResponse({
    description:
      'Profile address created or updated successfully. Returns the updated authenticated user payload.',
    type: UserDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async uploadAddress(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
    @Body() dto: UpdateAddressDto,
  ): Promise<UserDto> {
    return this.svc.updateAddress(user, session, dto);
  }

  // DELETE /address
  @Delete('address')
  @ApiOperation({
    summary: 'Remove profile address',
    description:
      'Removes the authenticated user’s profile address. The address relation is cleared from the user profile and the existing address record is deleted through the user aggregate. If no address exists, the request fails.',
  })
  @ApiOkResponse({
    description:
      'Profile address removed successfully. Returns the updated authenticated user payload.',
    type: UserDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async removeAddress(
    @CurrentUser() user: UserEntity,
    @CurrentSession() session: UserSessionEntity,
  ): Promise<UserDto> {
    return this.svc.removeAddress(user, session);
  }
}
