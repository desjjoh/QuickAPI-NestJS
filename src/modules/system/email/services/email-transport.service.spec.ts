import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';

import { EmailJobPayload } from '../queues/jobs.types';
import { EmailTransportService } from './email-transport.service';

describe('EmailTransportService', () => {
  const getOrThrow = jest.fn();
  const sendEmail = jest.fn();
  let service: EmailTransportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailTransportService(
      { sendEmail } as unknown as postmark.ServerClient,
      { getOrThrow } as unknown as ConfigService,
    );
  });

  it('maps every job payload field to the corresponding Postmark property', async () => {
    getOrThrow.mockReturnValue('sender@example.com');
    sendEmail.mockResolvedValue({});
    const payload: EmailJobPayload = {
      to: 'recipient@example.com',
      subject: 'Account ready',
      htmlBody: '<p>Your account is ready.</p>',
      messageStream: 'transactional',
      tag: 'account',
      metadata: { userId: 'user-1', correlationId: 'correlation-1' },
    };

    await expect(service.sendCompiledEmail(payload)).resolves.toBeUndefined();

    expect(getOrThrow).toHaveBeenCalledWith('POSTMARK_FROM_EMAIL');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({
      From: 'sender@example.com',
      To: 'recipient@example.com',
      Subject: 'Account ready',
      HtmlBody: '<p>Your account is ready.</p>',
      MessageStream: 'transactional',
      Tag: 'account',
      Metadata: { userId: 'user-1', correlationId: 'correlation-1' },
    });
  });

  it('propagates missing sender configuration without calling Postmark', async () => {
    const error = new Error('POSTMARK_FROM_EMAIL is missing');
    getOrThrow.mockImplementation(() => {
      throw error;
    });

    await expect(
      service.sendCompiledEmail({
        to: 'recipient@example.com',
        subject: 'Subject',
        htmlBody: '<p>Body</p>',
        messageStream: 'outbound',
      }),
    ).rejects.toBe(error);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('propagates Postmark failures so the queue can retry the job', async () => {
    const error = new Error('Postmark unavailable');
    getOrThrow.mockReturnValue('sender@example.com');
    sendEmail.mockRejectedValue(error);

    await expect(
      service.sendCompiledEmail({
        to: 'recipient@example.com',
        subject: 'Subject',
        htmlBody: '<p>Body</p>',
        messageStream: 'outbound',
      }),
    ).rejects.toBe(error);
  });
});
