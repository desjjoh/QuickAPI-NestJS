import { Job } from 'bullmq';
import { EmailTransportService } from '../services/email-transport.service';
import { EmailQueueProcessor } from './email.processor';

describe('EmailQueueProcessor', () => {
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
