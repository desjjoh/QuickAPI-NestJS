import { CsrfGuard } from '@/common/guards/csrf.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { RefreshTokenGuard } from '@/common/guards/refresh.guard';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import {
  Controller,
  UseGuards,
  Delete,
  Patch,
  Put,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
} from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { FileInterceptor } from '@nestjs/platform-express';
import { storage } from '@/config/storage.config';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';
import { ProfileApiService } from '../services/profile.service';
import { megabyte } from '@/common/constants/bytes.constants';
import type { Response } from 'express';
import { UpdateAddressDto } from '../models/updateAddress.model';

@ApiTags('Profile Management')
@ApiBearerAuth('access-token')
@Controller('profile')
@UseGuards(CsrfGuard, RefreshTokenGuard, PermissionsGuard)
export class ProfileApiController {
  public constructor(private readonly svc: ProfileApiService) {}

  // PATCH /
  @Patch('')
  @ApiBody({ type: Object })
  @ApiOperation({
    summary: 'Update profile information',
    description:
      'Updates profile details for the authenticated account, such as name, date of birth, gender, or contact information.',
  })
  @ApiOkResponse({
    description: 'Profile information updated successfully.',
    type: JWTDto,
  })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async updateProfile(
    @CurrentUser() user: UserEntity,
    @Body() dto: object,
    @Res({ passthrough: true }) res: Response,
  ) {
    void user;
    void dto;
    void res;
  }

  // PUT /avatar
  @Put('avatar')
  @ApiOperation({
    summary: 'Set profile avatar',
    description:
      'Uploads and sets the authenticated user’s profile avatar. Replaces the existing avatar if one is already assigned.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    description: 'Profile avatar updated successfully.',
    type: JWTDto,
  })
  @UseInterceptors(FileInterceptor('avatar', { storage }))
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async uploadAvatar(
    @CurrentUser() user: UserEntity,
    @UploadedFile(
      new ImageUploadValidationPipe({
        maxSize: 1 * megabyte,
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.uploadAvatar(user, file, res);
  }

  // DELETE /avatar
  @Delete('avatar')
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async removeAvatar(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.removeAvatar(user, res);
  }

  // PUT /address
  @Put('address')
  @ApiBody({ type: UpdateAddressDto })
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async uploadAddress(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateAddressDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.updateAddress(user, dto, res);
  }

  // DELETE /address
  @Delete('address')
  @Permissions(
    PERMISSION_MATRIX[PermissionDomain.ACCOUNT_MANAGEMENT].UPDATE_ACCOUNT,
  )
  public async removeAddress(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JWTDto> {
    return this.svc.removeAddress(user, res);
  }
}
