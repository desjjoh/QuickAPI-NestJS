import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import {
  runInTransaction,
  hasApplicationTransaction,
} from '@/common/helpers/transaction.helper';
import { RequestContext } from '@/common/store/request-context.store';
import { InvalidOperationError } from '@/common/errors/operation.error';
import { logger } from '@/config/logger.config';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import { StorageDeletionIntentEntity } from '../entities/storage-deletion-intent.entity';
import { StorageDeletionIntentRepository } from '../repositories/storage-deletion-intent.repository';
import { StorageReferenceReader } from '../types/storage-reference-reader';
import { StorageObjectService } from '@/modules/system/storage/services/storage-object.service';
import { StorageObjectEntity } from '@/modules/system/storage/entities/storage-object.entity';
import {
  storageCleanupPolicy,
  STORAGE_CLEANUP_FAILURE,
  type StorageCleanupOutcome,
} from '../types/storage-cleanup.contract';
import {
  STORAGE_CLEANUP_ATTEMPTS,
  StorageCleanupQueue,
} from '../queues/storage-cleanup.queue';

const failureReason = STORAGE_CLEANUP_FAILURE;

async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Storage cleanup operation timed out.')),
          storageCleanupPolicy.operationTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class StorageCleanupService {
  public constructor(
    private readonly repository: StorageDeletionIntentRepository,
    private readonly references: StorageReferenceReader,
    private readonly storage: StorageService,
    private readonly queue: StorageCleanupQueue,
    private readonly context: RequestContext,
    private readonly objects: StorageObjectService,
  ) {}

  /** The caller must persist this alongside the image mutation, never after commit. */
  public async schedule(
    manager: EntityManager,
    storageKey: string,
    reason: StorageDeletionIntentEntity['reason'],
  ): Promise<string> {
    if (!storageKey || storageKey.length > 255)
      throw new InvalidOperationError('Invalid managed storage key.');
    if (!manager.queryRunner?.isTransactionActive)
      throw new InvalidOperationError(
        'Storage deletion intents require the originating mutation transaction.',
      );
    const id = randomUUID();

    await this.objects.ensureTracked(manager, storageKey);
    await manager.insert(StorageDeletionIntentEntity, {
      id,
      storage_key: storageKey,
      reason,
      state: 'pending',
      attempts: 0,
      request_id: this.context.get('requestId') ?? null,
      created_at: new Date(),
      available_at: new Date(),
      last_error: null,
      completed_at: null,
      dlq_forwarded: false,
    });

    return id;
  }

  public async dispatch(): Promise<void> {
    this.assertWorkerBoundary();

    try {
      await this.reconcile();
    } catch {
      // A failed existence probe must not starve existing intents or DLQ handoffs.
      logger.error('Storage reconciliation failed; tracking records retained.');
    }

    // Claim briefly in SQL; never hold DB locks while waiting for Redis.
    const intents = await runInTransaction(
      this.repository.manager,
      async (manager) => {
        const due = await this.repository.findDue(manager);

        for (const intent of due)
          await manager.update(
            StorageDeletionIntentEntity,
            { id: intent.id },
            {
              available_at: new Date(
                Date.now() + storageCleanupPolicy.dispatchLeaseMs,
              ),
            },
          );

        return due;
      },
    );

    for (const intent of intents) {
      try {
        if (intent.state === 'failed') await this.forwardFailure(intent);
        else await bounded(this.queue.enqueue(intent.id));
      } catch {
        logger.error(
          { intentId: intent.id },
          'Storage cleanup dispatch failed; durable intent retained.',
        );
        // Avoid spending the entire batch timeout budget during a Redis outage.
        break;
      }
    }
  }

  public async deleteObject(id: string): Promise<StorageCleanupOutcome> {
    this.assertWorkerBoundary();
    // Persist the ownership fence BEFORE contacting storage. A crash or timeout
    // after DELETE must never roll the key back into an attachable state.
    const claimed = await runInTransaction(
      this.repository.manager,
      async (manager) => {
        const intent = await this.repository.findLocked(manager, id);

        if (!intent) return 'missing' as const;
        if (intent.state !== 'pending') return intent.state;
        const object = await this.objects.lock(manager, intent.storage_key);

        if (!object)
          throw new Error('Storage deletion has no ownership record.');
        if (
          await this.references.findByStorageKey(manager, intent.storage_key)
        ) {
          await manager.update(
            StorageDeletionIntentEntity,
            { id },
            {
              state: 'blocked',
              last_error: 'Storage object is still referenced.',
            },
          );

          return 'blocked' as const;
        }

        // Commit the ownership fence before remote deletion. Later attachment
        // attempts must fail even if the provider call or this worker crashes.
        await this.objects.markDeleting(manager, intent.storage_key);

        return 'claimed' as const;
      },
    );

    if (claimed !== 'claimed') return claimed;
    const result = await runInTransaction(
      this.repository.manager,
      async (manager) => {
        const intent = await this.repository.findLocked(manager, id);

        if (!intent) return { failed: false, outcome: 'missing' as const };
        if (intent.state !== 'pending')
          return { failed: false, outcome: intent.state };
        const attempts = intent.attempts + 1;

        if (intent.attempts >= STORAGE_CLEANUP_ATTEMPTS) {
          await manager.update(
            StorageDeletionIntentEntity,
            { id },
            { state: 'failed', available_at: new Date() },
          );

          return { failed: true, outcome: 'failed' as const };
        }

        try {
          await bounded(this.storage.deleteObject({ key: intent.storage_key }));
        } catch {
          // Commit failure accounting before throwing so BullMQ can retry it.
          await manager.update(
            StorageDeletionIntentEntity,
            { id },
            {
              attempts,
              state:
                attempts >= STORAGE_CLEANUP_ATTEMPTS ? 'failed' : 'pending',
              last_error: failureReason,
              available_at: new Date(),
            },
          );

          return { failed: true, outcome: 'failed' as const };
        }

        await manager.update(
          StorageDeletionIntentEntity,
          { id },
          {
            attempts,
            state: 'completed',
            completed_at: new Date(),
            last_error: null,
          },
        );
        await this.objects.markDeleted(manager, intent.storage_key);

        return { failed: false, outcome: 'completed' as const };
      },
    );

    if (result.failed) throw new Error(failureReason);

    return result.outcome;
  }

  public async reconcile(): Promise<void> {
    this.assertWorkerBoundary();
    await runInTransaction(this.repository.manager, async (manager) => {
      for (const object of await this.objects.abandoned(manager)) {
        if (
          await this.references.findByStorageKey(manager, object.storage_key)
        ) {
          // Conservative recovery for a legacy writer: references always win.
          await manager.update(
            StorageObjectEntity,
            { storage_key: object.storage_key },
            {
              state: 'attached',
              expires_at: null,
            },
          );
          continue;
        }

        if (
          object.state === 'deleted' &&
          !(await bounded(this.storage.objectExists(object.storage_key)))
        ) {
          await manager.update(
            StorageObjectEntity,
            { storage_key: object.storage_key },
            { expires_at: null },
          );
          continue;
        }

        await this.objects.markDeleting(manager, object.storage_key);
        await this.schedule(
          manager,
          object.storage_key,
          object.state === 'deleted'
            ? 'late_upload_detected'
            : 'upload_abandoned',
        );
      }
    });
  }

  private assertWorkerBoundary(): void {
    if (hasApplicationTransaction())
      throw new InvalidOperationError(
        'Storage cleanup must run outside request transactions.',
      );
  }

  private async forwardFailure(
    intent: StorageDeletionIntentEntity,
  ): Promise<void> {
    await bounded(
      this.queue.deadLetter({
        intentId: intent.id,
        attempts: intent.attempts,
        reason: failureReason,
      }),
    );
    await this.repository.manager.update(
      StorageDeletionIntentEntity,
      { id: intent.id, state: 'failed' },
      {
        dlq_forwarded: true,
      },
    );
  }
}
