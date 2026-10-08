import { IsNull, MoreThan, Not } from 'typeorm';

import { UserSessionEntity } from '../entities/session.entity';
import { SessionRepository } from './session.repository';

describe('SessionRepository', () => {
  const persistence = { find: jest.fn(), findOne: jest.fn() };
  const manager = { getRepository: jest.fn().mockReturnValue(persistence) };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue({
      target: UserSessionEntity,
      manager,
    }),
  };
  let repository: SessionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.getRepository.mockReturnValue(persistence);
    persistence.find.mockResolvedValue([]);
    persistence.findOne.mockResolvedValue(null);
    repository = new SessionRepository(dataSource as never);
  });

  it.each([
    ['without loading the user', false, undefined],
    ['while loading the user', true, { user: true }],
  ])('finds a user-owned session %s', async (_case, withUser, relations) => {
    await repository.findByUser(
      manager as never,
      'user-1',
      'session-1',
      withUser,
    );

    expect(manager.getRepository).toHaveBeenCalledWith(UserSessionEntity);
    expect(persistence.findOne).toHaveBeenCalledWith({
      where: { id: 'session-1', user: { id: 'user-1' } },
      ...(relations ? { relations } : {}),
    });
  });

  it('lists only recent active sessions that still have refresh material', async () => {
    const updatedAfter = new Date('2026-01-01T00:00:00.000Z');

    await expect(
      repository.findActiveByUser(manager as never, 'user-1', updatedAfter),
    ).resolves.toEqual([]);

    expect(persistence.find).toHaveBeenCalledWith({
      where: {
        user: { id: 'user-1' },
        active: true,
        refresh: Not(IsNull()),
        updatedAt: MoreThan(updatedAfter),
      },
      order: { createdAt: 'DESC' },
    });
  });

  it('exposes reads but no persistence mutation API', () => {
    expect(repository).not.toHaveProperty('save');
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('delete');
    expect(repository).not.toHaveProperty('remove');
  });
});
