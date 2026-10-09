import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { compile } from '@/common/helpers/handlebars.helper';

import { SendEmailOptions } from '../types/options.types';
import { createHmac } from 'node:crypto';
import { env } from '@/config/environment.config';
import { EmailOutboxService } from './email-outbox.service';

@Injectable()
export class EmailService {
  public constructor(
    private readonly configSvc: ConfigService,
    private readonly outbox: EmailOutboxService,
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

    const minutes = options.model?.expiresInMinutes;
    const challenge = metadata.tokenId ?? metadata.challengeId;
    const scope = challenge
      ? createHmac('sha256', env.CRYPTO_SECRET)
          .update(
            JSON.stringify([
              metadata.userId || options.to.trim().toLowerCase(),
              options.template.key,
              metadata.purpose ?? '',
            ]),
          )
          .digest('hex')
      : undefined;
    const expiresAt =
      options.expiresAt ??
      new Date(
        Date.now() +
          (typeof minutes === 'number' &&
          Number.isFinite(minutes) &&
          minutes > 0
            ? Math.min(minutes, 1440)
            : 1440) *
            60_000,
      );
    await this.outbox.storeIntent(
      {
        to: options.to,
        subject: options.template.subject,
        htmlBody,
        messageStream,
        tag: options.tag ?? options.template.tag,
        metadata,
      },
      expiresAt,
      scope,
    );
  }
}
