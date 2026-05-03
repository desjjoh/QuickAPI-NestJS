import { megabyte } from '@/common/constants/bytes.constants';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';
import { storage } from '@/config/storage.config';
import { Controller, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger/dist/decorators';

@ApiTags('Test Routes')
@Controller()
export class TestController {
  // PUT /image
  @Put('image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', { storage }))
  public async uploadAvatar(
    @UploadedFile(
      new ImageUploadValidationPipe({
        maxSize: 1 * megabyte,
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ): Promise<void> {
    void file;
  }
}
