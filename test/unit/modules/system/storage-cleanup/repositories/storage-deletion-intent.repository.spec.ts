import { StorageDeletionIntentRepository } from '@/modules/system/storage-cleanup/repositories/storage-deletion-intent.repository';
import { StorageDeletionIntentEntity } from '@/modules/system/storage-cleanup/entities/storage-deletion-intent.entity';

describe('StorageDeletionIntentRepository', () => {
  const setup = () => {
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const persistence = {
      createQueryBuilder: jest.fn(() => query),
      findOne: jest.fn(),
    };
    const manager = { getRepository: jest.fn(() => persistence) };
    const repository = new StorageDeletionIntentRepository({
      getRepository: () => ({ manager }),
    } as never);
    return { query, persistence, manager, repository };
  };
  it('selects only due pending work or terminal work awaiting DLQ forwarding in bounded locked batches', async () => {
    const { repository, manager, query } = setup();
    await repository.findDue(manager as never);
    expect(manager.getRepository).toHaveBeenCalledWith(
      StorageDeletionIntentEntity,
    );
    expect(query.where).toHaveBeenCalledWith('intent.available_at <= :now', {
      now: expect.any(Date),
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      '(intent.state = :pending OR (intent.state = :failed AND intent.dlq_forwarded = false))',
      { pending: 'pending', failed: 'failed' },
    );
    expect(query.take).toHaveBeenCalledWith(20);
    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(query.setOnLocked).toHaveBeenCalledWith('skip_locked');
  });
  it('locks an individual intent through the caller manager', async () => {
    const { repository, manager, persistence } = setup();
    await repository.findLocked(manager as never, 'id');
    expect(persistence.findOne).toHaveBeenCalledWith({
      where: { id: 'id' },
      lock: { mode: 'pessimistic_write' },
    });
  });
});
