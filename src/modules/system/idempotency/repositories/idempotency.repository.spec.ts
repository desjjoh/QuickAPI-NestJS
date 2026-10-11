import type { DataSource, EntityManager } from 'typeorm';
import { IdempotencyEntity } from '../entities/idempotency.entity';
import { IdempotencyRepository } from './idempotency.repository';

describe('IdempotencyRepository', () => {
  it('exposes the configured manager and connection namespace without mutating data', () => {
    const runner = {};
    const connection = {
      options: { database: 'quickapi' },
      createQueryRunner: jest.fn(() => runner),
    };
    const manager = { connection };
    const source = {
      getRepository: jest.fn(() => ({ manager })),
    } as unknown as DataSource;
    const repository = new IdempotencyRepository(source);
    expect(source.getRepository).toHaveBeenCalledWith(IdempotencyEntity);
    expect(repository.manager).toBe(manager);
    expect(repository.namespace).toBe('quickapi');
    expect(repository.createQueryRunner()).toBe(runner);
  });

  it.each([{ scope_hash: 'scope' }, null])(
    'reads scope %j without a gap lock using the caller’s transaction manager',
    async (row) => {
      const findOne = jest.fn(async () => row);
      const transaction = {
        getRepository: jest.fn(() => ({ findOne })),
      } as unknown as EntityManager;
      const source = {
        getRepository: jest.fn(() => ({ manager: {} })),
      } as unknown as DataSource;
      const repository = new IdempotencyRepository(source);
      expect(await repository.findByScope(transaction, 'scope')).toBe(row);
      expect(transaction.getRepository).toHaveBeenCalledWith(IdempotencyEntity);
      expect(findOne).toHaveBeenCalledWith({
        where: { scope_hash: 'scope' },
      });
    },
  );
});
