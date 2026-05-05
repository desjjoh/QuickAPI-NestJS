// src/system/email/email.service.ts

import { Inject, Injectable } from '@nestjs/common';
import * as postmark from 'postmark';

import { ConfigService } from '@nestjs/config';

import { POSTMARK_CLIENT } from '../tokens/client.token';
import { SendEmailOptions } from '../types/options.types';
import { ConfigurationError } from '@/common/errors/config.error';
import { InvalidOperationError } from '@/common/errors/operation.error';

@Injectable()
export class EmailService {
  public constructor(
    @Inject(POSTMARK_CLIENT)
    private readonly postmarkClient: postmark.ServerClient,
    private readonly configService: ConfigService,
  ) {}

  public async sendEmail(options: SendEmailOptions): Promise<void> {
    const from = this.configService.get<string>('POSTMARK_FROM_EMAIL');
    const messageStream =
      this.configService.get<string>('POSTMARK_MESSAGE_STREAM') ?? 'outbound';

    if (!from) throw new ConfigurationError('POSTMARK_FROM_EMAIL is required.');

    if (!options.textBody && !options.htmlBody)
      throw new InvalidOperationError(
        'Either textBody or htmlBody is required.',
      );

    await this.postmarkClient.sendEmail({
      From: from,
      To: options.to,
      Subject: options.subject,
      TextBody: options.textBody,
      HtmlBody: options.htmlBody,
      MessageStream: messageStream,
      Tag: options.tag,
      Metadata: options.metadata,
    });
  }
}
