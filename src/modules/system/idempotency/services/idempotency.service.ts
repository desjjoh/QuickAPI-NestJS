import {
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { LessThanOrEqual } from 'typeorm';
import {
  runInTransaction,
  withApplicationTransaction,
  hasApplicationTransaction,
} from '@/common/helpers/transaction.helper';
import { InvalidOperationError } from '@/common/errors/operation.error';
import { idempotencyPolicy } from '@/config/idempotency.config';
import { logger } from '@/config/logger.config';
import { IdempotencyEntity } from '../entities/idempotency.entity';
import { IdempotencyRepository } from '../repositories/idempotency.repository';

export type IdempotencyScope = {
  actorId: string;
  operation: string;
  route: string;
};
export type IdempotentResponse = { status: number; body: unknown };

@Injectable()
export class IdempotencyService implements OnModuleInit, OnModuleDestroy {
  private sweepTimer?: NodeJS.Timeout;

  public constructor(private readonly repository: IdempotencyRepository) {}

  public onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      void this.purgeExpired().catch((error) =>
        logger.error({ error }, 'Idempotency response cleanup failed.'),
      );
    }, idempotencyPolicy.sweepIntervalMs);
    this.sweepTimer.unref();
  }

  public onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  public async purgeExpired(): Promise<void> {
    await this.repository.manager.delete(IdempotencyEntity, {
      expires_at: LessThanOrEqual(new Date()),
    });
  }

  public async execute(
    scope: IdempotencyScope,
    key: string,
    fingerprint: string,
    work: () => Promise<IdempotentResponse>,
  ): Promise<IdempotentResponse> {
    if (hasApplicationTransaction())
      throw new InvalidOperationError(
        'Idempotent request transactions cannot be nested.',
      );
    const scopeHash = createHash('sha256')
      .update(
        JSON.stringify([
          this.repository.namespace,
          scope.actorId,
          scope.operation,
          scope.route,
          key,
        ]),
      )
      .digest('hex');
    const runner = this.repository.createQueryRunner();
    let locked = false;
    let connection: { destroy?: () => void } | undefined;
    try {
      connection = await runner.connect();
      // A non-waiting, connection-scoped MySQL lock also coordinates other API instances.
      // It is held until commit and storage lifecycle hooks have completed.
      const locks = await runner.query('SELECT GET_LOCK(?, 0) AS acquired', [
        scopeHash,
      ]);
      if (Number(locks[0]?.acquired) !== 1)
        throw new ConflictException(
          'This idempotent request is already processing. Retry with the same key.',
        );
      locked = true;

      return await runInTransaction(
        runner.manager,
        async (manager, lifecycle) => {
          const existing = await this.repository.findByScope(
            manager,
            scopeHash,
          );
          if (existing && existing.expires_at.getTime() > Date.now()) {
            if (existing.fingerprint !== fingerprint)
              throw new ConflictException(
                'Idempotency-Key was already used with a different payload.',
              );
            if (existing.state !== 'completed')
              throw new ConflictException(
                'This idempotent request is already processing.',
              );
            return {
              status: existing.response_status!,
              body: existing.response_body,
            };
          }
          if (existing)
            await manager.delete(IdempotencyEntity, { scope_hash: scopeHash });
          await manager.insert(IdempotencyEntity, {
            scope_hash: scopeHash,
            actor_id: scope.actorId,
            operation: scope.operation,
            route: scope.route,
            fingerprint,
            state: 'processing',
            expires_at: new Date(Date.now() + idempotencyPolicy.retentionMs),
          });
          const response = await withApplicationTransaction(
            manager,
            lifecycle,
            work,
          );
          // Store the original JSON response, not a later projection of a mutable resource.
          const body = JSON.parse(
            JSON.stringify(
              response.status === 204 ? null : (response.body ?? null),
            ),
          ) as unknown;
          const identity =
            body &&
            typeof body === 'object' &&
            'id' in body &&
            typeof body.id === 'string'
              ? body.id
              : null;
          await manager.update(
            IdempotencyEntity,
            { scope_hash: scopeHash },
            {
              state: 'completed',
              response_status: response.status,
              response_body: body as never,
              response_identity: identity,
            },
          );
          return { status: response.status, body };
        },
      );
    } finally {
      try {
        if (locked) await runner.query('SELECT RELEASE_LOCK(?)', [scopeHash]);
      } catch (error) {
        // Never return a still-locked session to the connection pool.
        connection?.destroy?.();
        logger.error(
          { error, scopeHash },
          'Idempotency lock release failed; discarded the database connection.',
        );
      } finally {
        await runner.release();
      }
    }
  }
}
