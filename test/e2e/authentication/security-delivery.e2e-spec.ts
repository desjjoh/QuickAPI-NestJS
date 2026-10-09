import { UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { redisConnection } from '@/config/redis.config';
import { EmailQueueService } from '@/modules/system/email/queues/queue.service';
import { EmailQueueProcessor } from '@/modules/system/email/processors/email.processor';
import type { EmailQueuePayload } from '@/modules/system/email/queues/jobs.types';
import { runInTransaction } from '@/common/helpers/transaction.helper';
import { MAX_VERIFICATION_CODE_ATTEMPTS } from '@/config/token.config';
import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';
import { RegistrationTokenRepository } from '@/modules/domain/identity/repositories/registration-token.repository';
import { RegistrationTokenService } from '@/modules/domain/identity/services/registration-token.service';
import { hashIdentityToken } from '@/modules/domain/identity/services/token-security';
import { EmailIntentEntity } from '@/modules/system/email/entities/email-intent.entity';
import { EmailIntentRepository } from '@/modules/system/email/repositories/email-intent.repository';
import { EmailOutboxService } from '@/modules/system/email/services/email-outbox.service';
import {
  closeTestDataSource,
  initializeTestDataSource,
  resetMutableTables,
} from '../../helpers/database/test-database';

describe('identity security and delivery (disposable MySQL)', () => {
  it('retries through a real Redis worker without exposing provider errors or duplicating committed delivery', async () => {
    // This uniquely named queue belongs only to this test; production queues are never cleared.
    const name = `e2e-email-${randomUUID()}`;
    const connection = { ...redisConnection, maxRetriesPerRequest: null };
    const deliveryQueue = new Queue<EmailQueuePayload>(name, { connection });
    const events = new QueueEvents(name, { connection });
    const queueService = new EmailQueueService(deliveryQueue);
    const delivery = new EmailOutboxService(
      new EmailIntentRepository(source),
      queueService,
      transport as never,
    );
    const processor = new EmailQueueProcessor(transport as never, delivery);
    const worker = new Worker<EmailQueuePayload>(
      name,
      (job) => processor.process(job),
      { connection },
    );
    try {
      await events.waitUntilReady();
      await delivery.storeIntent(payload);
      const intent = (await source.getRepository(EmailIntentEntity).find())[0];
      transport.sendCompiledEmail
        .mockRejectedValueOnce(
          new Error('private recipient=security@example.test code=123456'),
        )
        .mockResolvedValue(undefined);
      await queueService.enqueueDelivery(intent.delivery_id);
      const job = (await deliveryQueue.getJob(`email-${intent.delivery_id}`))!;
      await job.waitUntilFinished(events, 15_000);
      expect(job.data).toEqual({ deliveryId: intent.delivery_id });
      const completed = (await deliveryQueue.getJob(job.id!))!;
      expect(completed.attemptsMade).toBe(2);
      expect(JSON.stringify(completed.stacktrace)).not.toContain(payload.to);
      expect(JSON.stringify(completed.stacktrace)).not.toContain('123456');
      expect(transport.sendCompiledEmail).toHaveBeenCalledTimes(2);
      expect(
        await source
          .getRepository(EmailIntentEntity)
          .findOneByOrFail({ delivery_id: intent.delivery_id }),
      ).toMatchObject({ state: 'delivered', ciphertext: null });
      await queueService.enqueueDelivery(intent.delivery_id);
      await job.waitUntilFinished(events, 15_000);
      expect(transport.sendCompiledEmail).toHaveBeenCalledTimes(2);
    } finally {
      await worker.close();
      await events.close();
      await deliveryQueue.obliterate();
      await deliveryQueue.close();
    }
  }, 30_000);
  it('retains encrypted intent after provider failure and retries with its original delivery ID', async () => {
    await outbox.storeIntent(payload);
    const row = (await source.getRepository(EmailIntentEntity).find())[0];
    transport.sendCompiledEmail
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValue(undefined);
    await expect(outbox.deliver(row.delivery_id)).rejects.toThrow(
      'provider unavailable',
    );
    expect(
      await source
        .getRepository(EmailIntentEntity)
        .findOneByOrFail({ delivery_id: row.delivery_id }),
    ).toMatchObject({ state: 'pending', ciphertext: row.ciphertext });
    await outbox.deliver(row.delivery_id);
    expect(transport.sendCompiledEmail).toHaveBeenNthCalledWith(1, {
      ...payload,
      metadata: { deliveryId: row.delivery_id },
    });
    expect(transport.sendCompiledEmail).toHaveBeenNthCalledWith(2, {
      ...payload,
      metadata: { deliveryId: row.delivery_id },
    });
    await outbox.deliver(row.delivery_id);
    expect(transport.sendCompiledEmail).toHaveBeenCalledTimes(2);
  });

  it('rolls back cancellation with a failed replacement and removes only expired tombstones', async () => {
    const scope = 'b'.repeat(64);
    await outbox.storeIntent(payload, new Date(Date.now() + 60_000), scope);
    const old = (await source.getRepository(EmailIntentEntity).find())[0];
    await expect(
      runInTransaction(source.manager, async () => {
        await outbox.storeIntent(payload, new Date(Date.now() + 60_000), scope);
        throw new Error('replacement failed');
      }),
    ).rejects.toThrow('replacement failed');
    expect(await source.getRepository(EmailIntentEntity).count()).toBe(1);
    expect(
      await source
        .getRepository(EmailIntentEntity)
        .findOneByOrFail({ delivery_id: old.delivery_id }),
    ).toMatchObject({ state: 'pending', ciphertext: old.ciphertext });
    await outbox.storeIntent(payload, new Date(Date.now() - 1_000));
    await outbox.dispatch();
    expect(
      await source
        .getRepository(EmailIntentEntity)
        .countBy({ state: 'expired' }),
    ).toBe(1);
    await source
      .getRepository(EmailIntentEntity)
      .update(
        { state: 'expired' },
        { expires_at: new Date(Date.now() - 2 * 86400_000) },
      );
    await outbox.dispatch();
    expect(await source.getRepository(EmailIntentEntity).count()).toBe(1);
    expect(
      (
        await source
          .getRepository(EmailIntentEntity)
          .findOneByOrFail({ delivery_id: old.delivery_id })
      ).state,
    ).toBe('pending');
  });
  let source: DataSource;
  let outbox: EmailOutboxService;
  let tokens: RegistrationTokenService;
  const queue = { enqueueDelivery: jest.fn<(id: string) => Promise<void>>() };
  const transport = { sendCompiledEmail: jest.fn<() => Promise<void>>() };
  const payload = {
    to: 'security@example.test',
    subject: 'Verify',
    htmlBody: '<p>123456</p>',
    messageStream: 'outbound',
  };

  beforeAll(async () => {
    source = await initializeTestDataSource();
    outbox = new EmailOutboxService(
      new EmailIntentRepository(source),
      queue as never,
      transport as never,
    );
    tokens = new RegistrationTokenService(
      new RegistrationTokenRepository(source),
    );
  });
  beforeEach(async () => {
    jest.resetAllMocks();
    await resetMutableTables(source);
  });
  afterAll(async () => {
    if (source) await closeTestDataSource(source);
  });

  const challenge = () =>
    tokens.createToken({
      email: payload.to,
      expiresInMs: 60_000,
      mfaCodeHash: hashIdentityToken('123456'),
      metadata: {
        email: payload.to,
        password: 'hash',
        profile: { name: { first: 'Test', last: 'User' } },
      } as never,
    });

  it('rolls back consumed challenges and durable email intents together', async () => {
    const token = await challenge();
    await expect(
      runInTransaction(source.manager, async () => {
        await tokens.consumeVerificationCode(token.id, '123456');
        await outbox.storeIntent(payload);
        throw new Error('audit failure');
      }),
    ).rejects.toThrow('audit failure');
    expect(
      (
        await source
          .getRepository(RegistrationTokenEntity)
          .findOneByOrFail({ id: token.id })
      ).consumed_at,
    ).toBeNull();
    expect(await source.getRepository(EmailIntentEntity).count()).toBe(0);
    expect(queue.enqueueDelivery).not.toHaveBeenCalled();
    await runInTransaction(source.manager, async () => {
      await tokens.consumeVerificationCode(token.id, '123456');
    });
    await expect(
      tokens.consumeVerificationCode(token.id, '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('persists failed OTP attempts and lockout despite request rollback', async () => {
    const token = await challenge();
    for (let attempt = 0; attempt < MAX_VERIFICATION_CODE_ATTEMPTS; attempt++) {
      await expect(
        runInTransaction(source.manager, async () => {
          await tokens.consumeVerificationCode(token.id, '000000');
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const stored = await source
      .getRepository(RegistrationTokenEntity)
      .findOneByOrFail({ id: token.id });
    expect(stored.failed_attempts).toBe(MAX_VERIFICATION_CODE_ATTEMPTS);
    expect(stored.locked_at).not.toBeNull();
    await expect(
      tokens.consumeVerificationCode(token.id, '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('serializes delivery and suppresses committed replay across connections', async () => {
    await outbox.storeIntent(payload);
    const intent = (await source.getRepository(EmailIntentEntity).find())[0];
    expect(intent.ciphertext).not.toContain('123456');
    expect(intent.ciphertext).not.toContain(payload.to);
    const second = new EmailOutboxService(
      new EmailIntentRepository(source),
      queue as never,
      transport as never,
    );
    await Promise.all([
      outbox.deliver(intent.delivery_id),
      second.deliver(intent.delivery_id),
    ]);
    expect(transport.sendCompiledEmail).toHaveBeenCalledTimes(1);
    const stored = await source
      .getRepository(EmailIntentEntity)
      .findOneByOrFail({ delivery_id: intent.delivery_id });
    expect(stored.state).toBe('delivered');
    expect(stored.ciphertext).toBeNull();
  });

  it('retries queue outages with the same ID and cancels superseded or expired intent', async () => {
    const scope = 'a'.repeat(64);
    await outbox.storeIntent(payload, new Date(Date.now() + 60_000), scope);
    const old = (await source.getRepository(EmailIntentEntity).find())[0];
    queue.enqueueDelivery.mockRejectedValueOnce(new Error('Redis unavailable'));
    await outbox.dispatch();
    await outbox.dispatch();
    expect(queue.enqueueDelivery.mock.calls).toEqual([
      [old.delivery_id],
      [old.delivery_id],
    ]);
    await outbox.storeIntent(payload, new Date(0), scope);
    await outbox.deliver(old.delivery_id);
    await outbox.dispatch();
    expect(transport.sendCompiledEmail).not.toHaveBeenCalled();
    expect(
      await source
        .getRepository(EmailIntentEntity)
        .countBy({ state: 'pending' }),
    ).toBe(0);
  });
});
