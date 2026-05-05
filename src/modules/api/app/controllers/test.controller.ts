import { megabyte } from '@/common/constants/bytes.constants';
import { ImageUploadValidationPipe } from '@/common/pipes/image-upload.pipe';
import { storage } from '@/config/storage.config';
import { EmailService } from '@/modules/system/email/services/email.service';
import {
  Controller,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger/dist/decorators';

@ApiTags('Test Routes')
@Controller()
export class TestController {
  constructor(private readonly emailSvc: EmailService) {}

  // POST /email
  @Post('send-email')
  public async sendTestEmail(): Promise<void> {
    await this.emailSvc.sendEmail({
      to: 'john.desjardins@littleknightsoftware.com',
      subject: 'Hello from Postmark',
      template: '<strong>Hello</strong> dear Postmark user.',
      model: {},
      tag: 'postmark-test',
      metadata: {
        source: 'email-test-controller',
      },
    });
  }

  // PUT /image
  @Put('upload-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', { storage }))
  public async recieveImage(
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
