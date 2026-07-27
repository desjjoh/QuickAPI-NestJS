import { ConfigService } from '@nestjs/config';

import { compile } from '@/common/helpers/handlebars.helper';

import { EmailQueueService } from '../queues/queue.service';
import { EmailService } from './email.service';

jest.mock('@/common/helpers/handlebars.helper', () => ({
  compile: jest.fn(),
}));

describe('EmailService', () => {
  const get = jest.fn();
  const enqueueEmail = jest.fn();
  const compileMock = jest.mocked(compile);
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailService(
      { get } as unknown as ConfigService,
      { enqueueEmail } as unknown as EmailQueueService,
    );
  });

  it('renders and queues the exact payload using configured values and overrides', async () => {
    get.mockReturnValue('broadcasts');
    compileMock.mockReturnValue('<p>Hello Ada</p>');
    const model = { firstName: 'Ada', accountId: 42 };

    await service.sendEmail({
      to: 'ada@example.com',
      template: {
        key: 'welcome',
        subject: 'Welcome!',
        html: '<p>Hello {{firstName}}</p>',
        tag: 'onboarding',
        metadata: {
          template: 'template-metadata-value',
          category: 'template-category',
          shared: 'template-value',
        },
      },
      model,
      tag: 'priority-onboarding',
      metadata: {
        category: 'request-category',
        shared: 'request-value',
        requestId: 'req-123',
      },
    });

    expect(get).toHaveBeenCalledWith('POSTMARK_MESSAGE_STREAM');
    expect(compileMock).toHaveBeenCalledWith({
      template: '<p>Hello {{firstName}}</p>',
      data: model,
    });
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledWith({
      to: 'ada@example.com',
      subject: 'Welcome!',
      htmlBody: '<p>Hello Ada</p>',
      messageStream: 'broadcasts',
      tag: 'priority-onboarding',
      metadata: {
        template: 'template-metadata-value',
        category: 'request-category',
        shared: 'request-value',
        requestId: 'req-123',
      },
    });
  });

  it('falls back to the outbound stream and template tag', async () => {
    get.mockReturnValue(undefined);
    compileMock.mockReturnValue('<p>Reset your password</p>');

    await service.sendEmail({
      to: 'user@example.com',
      template: {
        key: 'password-reset',
        subject: 'Password reset',
        html: '<p>Reset your password</p>',
        tag: 'security',
        metadata: {},
      },
    });

    expect(compileMock).toHaveBeenCalledWith({
      template: '<p>Reset your password</p>',
      data: undefined,
    });
    expect(enqueueEmail).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Password reset',
      htmlBody: '<p>Reset your password</p>',
      messageStream: 'outbound',
      tag: 'security',
      metadata: {
        template: 'password-reset',
        category: 'security',
      },
    });
  });
});
