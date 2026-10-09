import type { EntityManager } from 'typeorm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { InvalidOperationError } from '@/common/errors/operation.error';

type TransactionAction = () => Promise<void> | void;
type CancelTransactionAction = () => void;

export type TransactionWork<T> = (
  manager: EntityManager,
  lifecycle: TransactionLifecycle,
) => Promise<T>;

const applicationTransaction = new AsyncLocalStorage<{
  manager: EntityManager;
  lifecycle: TransactionLifecycle;
}>();

export const hasApplicationTransaction = (): boolean =>
  applicationTransaction.getStore() !== undefined;

/** Explicit opt-in for application concerns that wrap an entire request transaction. */
export function withApplicationTransaction<T>(
  manager: EntityManager,
  lifecycle: TransactionLifecycle,
  work: () => Promise<T>,
): Promise<T> {
  return applicationTransaction.run({ manager, lifecycle }, work);
}

/**
 * Coordinates side effects that cannot participate in the database transaction.
 * Rollback actions run in reverse registration order; commit actions run in order.
 */
export class TransactionLifecycle {
  private afterCommitActions: TransactionAction[] = [];
  private afterRollbackActions: TransactionAction[] = [];
  private completed = false;

  public afterCommit(action: TransactionAction): CancelTransactionAction {
    return this.register(this.afterCommitActions, action);
  }

  public afterRollback(action: TransactionAction): CancelTransactionAction {
    return this.register(this.afterRollbackActions, action);
  }

  public async commit(): Promise<void> {
    this.assertPending();
    this.completed = true;
    this.afterRollbackActions = [];

    await this.execute(this.afterCommitActions);
  }

  public async rollback(): Promise<void> {
    this.assertPending();
    this.completed = true;
    this.afterCommitActions = [];

    await this.execute([...this.afterRollbackActions].reverse());
  }

  private register(
    actions: TransactionAction[],
    action: TransactionAction,
  ): CancelTransactionAction {
    this.assertPending();
    actions.push(action);

    return () => {
      const index = actions.indexOf(action);
      if (index >= 0) actions.splice(index, 1);
    };
  }

  private assertPending(): void {
    if (this.completed)
      throw new Error('The transaction lifecycle has already completed.');
  }

  private async execute(actions: TransactionAction[]): Promise<void> {
    const failures: unknown[] = [];

    for (const action of actions) {
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        'Multiple transaction lifecycle actions failed.',
      );
  }
}

/** Runs database work first, then resolves its non-database lifecycle actions. */
export async function runInTransaction<T>(
  manager: EntityManager,
  work: TransactionWork<T>,
): Promise<T> {
  const outer = applicationTransaction.getStore();
  if (outer) {
    if (!outer.manager.queryRunner?.isTransactionActive)
      throw new InvalidOperationError(
        'The application transaction is no longer active.',
      );
    if (manager.connection !== outer.manager.connection)
      throw new InvalidOperationError(
        'An application transaction cannot span different data sources.',
      );
    return work(outer.manager, outer.lifecycle);
  }
  if (manager.queryRunner?.isTransactionActive)
    throw new InvalidOperationError(
      'Reuse the outer transaction manager and lifecycle instead of starting a nested lifecycle.',
    );

  const lifecycle = new TransactionLifecycle();
  let result: T;

  try {
    result = await manager.transaction((transactionManager) =>
      work(transactionManager, lifecycle),
    );
  } catch (transactionError) {
    try {
      await lifecycle.rollback();
    } catch (rollbackError) {
      throw new AggregateError(
        [transactionError, rollbackError],
        'The database transaction rolled back, but its compensating actions failed.',
        { cause: transactionError },
      );
    }

    throw transactionError;
  }

  await lifecycle.commit();
  return result;
}
