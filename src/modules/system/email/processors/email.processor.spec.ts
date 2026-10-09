import { Job } from 'bullmq';
import { EmailTransportService } from '../services/email-transport.service';
import { EmailQueueProcessor } from './email.processor';

describe('EmailQueueProcessor', () => {
  it('resolves durable IDs and sanitizes provider failure details before Redis persistence', async () => {
    const id = '01234567-89ab-4cde-8fab-0123456789ab';
    const deliver = jest
      .fn()
      .mockRejectedValue(new Error('person@example.test code=123456'));
    const sendCompiledEmail = jest.fn();
    const processor = new EmailQueueProcessor(
      { sendCompiledEmail } as never,
      { deliver } as never,
    );
    await expect(
      processor.process({ data: { deliveryId: id } } as Job),
    ).rejects.toThrow('Email delivery failed; durable intent remains pending.');
    expect(deliver).toHaveBeenCalledWith(id);
    expect(sendCompiledEmail).not.toHaveBeenCalled();
    await expect(
      processor.process({ data: { deliveryId: 'invalid' } } as Job),
    ).rejects.toThrow('Malformed email delivery job.');
  });
  const payload = {
    to: 'u@example.com',
    subject: 'Hi',
    htmlBody: '<p>Hi</p>',
    messageStream: 'outbound',
  };

  it('passes valid jobs to the transport and propagates send failures for retry', async () => {
    const error = new Error('temporary');
    const sendCompiledEmail = jest.fn().mockRejectedValue(error);
    const processor = new EmailQueueProcessor({
      sendCompiledEmail,
    } as unknown as EmailTransportService);
    await expect(processor.process({ data: payload } as Job)).rejects.toBe(
      error,
    );
    expect(sendCompiledEmail).toHaveBeenCalledWith(payload);
  });

  it('rejects malformed jobs without calling the transport', async () => {
    const sendCompiledEmail = jest.fn();
    const processor = new EmailQueueProcessor({
      sendCompiledEmail,
    } as unknown as EmailTransportService);
    await expect(
      processor.process({ data: { to: 'u@example.com' } } as Job),
    ).rejects.toThrow('Malformed email job payload.');
    expect(sendCompiledEmail).not.toHaveBeenCalled();
  });
});
