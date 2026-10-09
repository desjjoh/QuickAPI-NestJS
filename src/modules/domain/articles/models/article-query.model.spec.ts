import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Order } from '@/common/models/pagination.model';

import {
  ArticleLifecycleQueryDto,
  ArticleQueryDto,
} from './article-query.model';

describe('ArticleQueryDto', () => {
  it('defaults to the newest first page', async () => {
    const query = plainToInstance(ArticleQueryDto, {});

    expect(query).toEqual(
      expect.objectContaining({
        search: '',
        order: Order.DESC,
        page: 1,
        take: 25,
        skip: 0,
      }),
    );
    await expect(validate(query)).resolves.toEqual([]);
  });

  it('transforms valid pagination values', async () => {
    const query = plainToInstance(ArticleQueryDto, {
      search: 'architecture',
      order: Order.ASC,
      page: '2',
      take: '10',
    });

    expect(query).toEqual(
      expect.objectContaining({ page: 2, take: 10, skip: 10 }),
    );
    await expect(validate(query)).resolves.toEqual([]);
  });

  it('rejects unbounded searches, page sizes, and unsupported ordering', async () => {
    const query = plainToInstance(ArticleQueryDto, {
      search: 'x'.repeat(256),
      order: 'RANDOM',
      page: 0,
      take: 101,
    });

    const errors = await validate(query);

    expect(errors.map(({ property }) => property).sort()).toEqual([
      'order',
      'page',
      'search',
      'take',
    ]);
  });
});

describe('ArticleLifecycleQueryDto', () => {
  it('accepts a known article status', async () => {
    const query = plainToInstance(ArticleLifecycleQueryDto, {
      statusKey: 'draft',
    });

    await expect(validate(query)).resolves.toEqual([]);
  });

  it('rejects an unknown article status', async () => {
    const query = plainToInstance(ArticleLifecycleQueryDto, {
      statusKey: 'deleted',
    });

    await expect(validate(query)).resolves.toEqual([
      expect.objectContaining({ property: 'statusKey' }),
    ]);
  });
});
