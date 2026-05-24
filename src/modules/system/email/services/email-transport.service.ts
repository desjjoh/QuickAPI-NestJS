import * as postmark from 'postmark';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { POSTMARK_CLIENT } from '../tokens/client.token';
import { EmailJobPayload } from '../queues/jobs.types';

@Injectable()
export class EmailTransportService {
  public constructor(
    @Inject(POSTMARK_CLIENT)
    private readonly postmarkClient: postmark.ServerClient,
    private readonly configSvc: ConfigService,
  ) {}

  public async sendCompiledEmail(payload: EmailJobPayload): Promise<void> {
    const from: string = this.configSvc.getOrThrow<string>(
      'POSTMARK_FROM_EMAIL',
    );

    await this.postmarkClient.sendEmail({
      From: from,
      To: payload.to,
      Subject: payload.subject,
      HtmlBody: payload.htmlBody,
      MessageStream: payload.messageStream,
      Tag: payload.tag,
      Metadata: payload.metadata,
    });
  }
}
