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
    private readonly configSvc: ConfigService,
  ) {}

  public async sendEmail<TModel extends Record<string, unknown>>(
    options: SendEmailOptions<TModel>,
  ): Promise<void> {
    const from: string = this.configSvc.getOrThrow<string>(
      'POSTMARK_FROM_EMAIL',
    );

    const messageStream =
      this.configSvc.get<string>('POSTMARK_MESSAGE_STREAM') ?? 'outbound';

    const htmlBody = compile<TModel>({
      template: options.template.html,
      data: options.model,
    });

    const metadata: Record<string, string> = {
      template: options.template.key,
      category: options.template.tag,
      ...options.template.metadata,
      ...options.metadata,
    };

    await this.postmarkClient.sendEmail({
      From: from,
      To: options.to,
      Subject: options.template.subject,
      HtmlBody: htmlBody,
      MessageStream: messageStream,
      Tag: options.tag ?? options.template.tag,
      Metadata: metadata,
    });
  }
}
