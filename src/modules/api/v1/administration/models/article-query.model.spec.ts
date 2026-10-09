import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AdministrationArticleQueryDto } from './article-query.model';

describe('AdministrationArticleQueryDto', () => {
  it('accepts a valid author filter', async () => {
    const query = plainToInstance(AdministrationArticleQueryDto, {
      authorId: 'A1b2C3d4E5f6G7h8',
    });

    await expect(validate(query)).resolves.toEqual([]);
  });

  it('rejects an invalid author filter', async () => {
    const query = plainToInstance(AdministrationArticleQueryDto, {
      authorId: 'invalid-id',
    });

    await expect(validate(query)).resolves.toEqual([
      expect.objectContaining({ property: 'authorId' }),
    ]);
  });
});
