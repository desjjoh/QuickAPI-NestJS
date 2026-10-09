import { ConflictException } from '@nestjs/common';
import { ArticleEntity } from '../entities/article.entity';
import { ArticleStatusTransitionPolicy } from '../policies/article-status-transition.policy';
import { ArticleService } from './article.service';

describe('article atomic version writes', () => {
  it('allows only one of two edits based on the same revision', async () => {
    let stored = {
      id: 'article-1',
      version: 1,
      content: { title: 'Original', summary: 'Summary', body: 'Body' },
      publication: { status: { key: 'draft' } },
    } as ArticleEntity;
    const manager = {
      update: jest.fn(async (_entity, criteria, input) => {
        if (criteria.version !== stored.version) return { affected: 0 };
        stored = {
          ...stored,
          content: { ...stored.content, ...input.content },
          version: stored.version + 1,
        };
        return { affected: 1 };
      }),
    };
    const repo = {
      manager,
      findById: jest.fn(async () => structuredClone(stored)),
    };
    const service = new ArticleService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      new ArticleStatusTransitionPolicy(),
    );
    const first = structuredClone(stored);
    const second = structuredClone(stored);
    const results = await Promise.allSettled([
      service.update(first, { content: { title: 'First edit' } }),
      service.update(second, { content: { title: 'Second edit' } }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect(stored.version).toBe(2);
    expect(stored.content.title).toBe('First edit');
    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(manager.update).toHaveBeenCalledWith(
      ArticleEntity,
      { id: 'article-1', version: 1 },
      expect.objectContaining({ version: expect.any(Function) }),
    );
    // Even an unchanged edit consumes its revision and cannot be replayed.
    await service.update(structuredClone(stored), {
      content: { title: stored.content.title },
    });
    expect(stored.version).toBe(3);
  });
});
