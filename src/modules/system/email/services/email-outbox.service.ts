import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { LessThanOrEqual, Not } from 'typeorm';
import { runInTransaction } from '@/common/helpers/transaction.helper';
import { env } from '@/config/environment.config';
import { logger } from '@/config/logger.config';
import { EmailIntentEntity } from '../entities/email-intent.entity';
import { EmailIntentRepository } from '../repositories/email-intent.repository';
import { EmailJobPayload } from '../queues/jobs.types';
import { EmailQueueService } from '../queues/queue.service';
import { EmailTransportService } from './email-transport.service';

const day = 24 * 60 * 60 * 1000;
// A disconnected Redis producer must not hold database locks indefinitely.
async function boundedDispatch(work: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Email queue dispatch timed out.')),
          5_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const encryptionKey = () =>
  createHash('sha256').update(`email-outbox-v1:${env.CRYPTO_SECRET}`).digest();
export function sealEmail(payload: EmailJobPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString('base64'))
    .join('.');
}
export function openEmail(value: string): EmailJobPayload {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid email intent ciphertext.');
  const [iv, tag, body] = parts.map((part) => Buffer.from(part, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8'),
  ) as EmailJobPayload;
}

@Injectable()
export class EmailOutboxService {
  public constructor(
    private readonly repository: EmailIntentRepository,
    private readonly queue: EmailQueueService,
    private readonly transport: EmailTransportService,
  ) {}
  public async storeIntent(
    payload: EmailJobPayload,
    expiresAt = new Date(Date.now() + day),
    scope?: string,
  ): Promise<void> {
    await runInTransaction(this.repository.manager, async (manager) => {
      if (scope)
        await manager.update(
          EmailIntentEntity,
          { cancellation_scope: scope, state: 'pending' },
          { state: 'cancelled', ciphertext: null },
        );
      await manager.insert(EmailIntentEntity, {
        delivery_id: randomUUID(),
        ciphertext: sealEmail(payload),
        state: 'pending',
        available_at: new Date(),
        created_at: new Date(),
        expires_at: expiresAt,
        cancellation_scope: scope ?? null,
      });
    });
  }
  public async dispatch(): Promise<void> {
    await this.repository.manager.update(
      EmailIntentEntity,
      { state: 'pending', expires_at: LessThanOrEqual(new Date()) },
      { state: 'expired', ciphertext: null },
    );
    await this.repository.manager.delete(EmailIntentEntity, {
      state: Not('pending'),
      expires_at: LessThanOrEqual(new Date(Date.now() - day)),
    });
    await runInTransaction(this.repository.manager, async (manager) => {
      for (const intent of await this.repository.findDue(manager)) {
        try {
          // A late enqueue after timeout is safe: its deterministic job ID is unchanged.
          await boundedDispatch(this.queue.enqueueDelivery(intent.delivery_id));
          await manager.update(
            EmailIntentEntity,
            { delivery_id: intent.delivery_id },
            { available_at: new Date(Date.now() + 60_000) },
          );
        } catch {
          // Never log compiled email bodies, OTPs, addresses, or provider errors.
          logger.error(
            { deliveryId: intent.delivery_id },
            'Email intent dispatch failed; durable intent remains pending.',
          );
          break;
        }
      }
    });
  }
  public async deliver(id: string): Promise<void> {
    await runInTransaction(this.repository.manager, async (manager) => {
      const intent = await this.repository.findForDelivery(manager, id);
      if (!intent || intent.state !== 'pending') return;
      if (intent.expires_at.getTime() <= Date.now()) {
        await manager.update(
          EmailIntentEntity,
          { delivery_id: id },
          { state: 'expired', ciphertext: null },
        );
        return;
      }
      if (!intent.ciphertext)
        throw new Error('Pending email intent has no payload.');
      const payload = openEmail(intent.ciphertext);
      await this.transport.sendCompiledEmail({
        ...payload,
        metadata: { ...payload.metadata, deliveryId: id },
      });
      await manager.update(
        EmailIntentEntity,
        { delivery_id: id },
        { state: 'delivered', delivered_at: new Date(), ciphertext: null },
      );
    });
  }
}
