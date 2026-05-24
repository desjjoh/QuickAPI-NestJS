import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { compile } from '@/common/helpers/handlebars.helper';

import { SendEmailOptions } from '../types/options.types';
import { EmailQueueService } from '../queues/queue.service';

@Injectable()
export class EmailService {
  public constructor(
    private readonly configSvc: ConfigService,
    private readonly emailQueueSvc: EmailQueueService,
  ) {}

  public async sendEmail<TModel extends Record<string, unknown>>(
    options: SendEmailOptions<TModel>,
  ): Promise<void> {
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

    await this.emailQueueSvc.enqueueEmail({
      to: options.to,
      subject: options.template.subject,
      htmlBody,
      messageStream,
      tag: options.tag ?? options.template.tag,
      metadata,
    });
  }
}
