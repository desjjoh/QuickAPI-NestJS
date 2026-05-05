import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';

import { POSTMARK_CLIENT } from '../tokens/client.token';
import { ConfigurationError } from '@/common/errors/config.error';

export const postmarkProvider = {
  provide: POSTMARK_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): postmark.ServerClient => {
    const serverToken = configService.get<string>('POSTMARK_SERVER_TOKEN');

    if (!serverToken)
      throw new ConfigurationError('POSTMARK_SERVER_TOKEN is required.');

    return new postmark.ServerClient(serverToken);
  },
};
