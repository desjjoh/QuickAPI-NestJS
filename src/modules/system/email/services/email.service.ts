import * as postmark from 'postmark';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { compile } from '@/common/helpers/handlebars.helper';

import { POSTMARK_CLIENT } from '../tokens/client.token';
import { SendEmailOptions } from '../types/options.types';

@Injectable()
export class EmailService {
  public constructor(
    @Inject(POSTMARK_CLIENT)
    private readonly postmarkClient: postmark.ServerClient,
    private readonly configService: ConfigService,
  ) {}

  public async sendEmail<TModel extends Record<string, unknown>>(
    options: SendEmailOptions<TModel>,
  ): Promise<void> {
    const from: string = this.configService.get<string>('POSTMARK_FROM_EMAIL')!;
    const messageStream = this.configService.get<string>(
      'POSTMARK_MESSAGE_STREAM',
    );

    const htmlTemplate = compile<TModel>({
      template: options.template,
      data: options.model,
    });

    await this.postmarkClient.sendEmail({
      From: from,
      To: options.to,
      Subject: options.subject,
      HtmlBody: htmlTemplate,
      MessageStream: messageStream,
      Tag: options.tag,
      Metadata: options.metadata,
    });
  }
}
