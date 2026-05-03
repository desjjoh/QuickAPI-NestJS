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
import { MeApiService } from '../services/me.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { storage } from '@/config/storage.config';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';

@ApiTags('Profile Management')
@ApiBearerAuth('access-token')
@Controller('profile')
@UseGuards(CsrfGuard, RefreshTokenGuard, PermissionsGuard)
export class ProfileApiController {
  public constructor(private readonly svc: MeApiService) {}

  // PATCH /profile
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
  ): Promise<JWTDto> {
    return;
  }

  // PUT /profile/avatar
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
    @UploadedFile(new ImageUploadValidationPipe({ fileIsRequired: true }))
    file: Express.Multer.File,
  ) {
    return;
  }

  // DELETE /profile/avatar
  @Delete('avatar')
  public async removeAvatar() {}

  // PUT /profile/address
  @Put('address')
  public async uploadAddress() {}

  // DELETE /profile/address
  @Delete('address')
  public async removeAddress() {}
}
