import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateArticleDto } from './update-article.model';

describe('UpdateArticleDto', () => {
  it('accepts valid partial article content', async () => {
    const dto = plainToInstance(UpdateArticleDto, {
      expected_version: 1,
      title: 'Updated title',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['title', '   '],
    ['summary', 'x'.repeat(256)],
    ['body', '\n\t'],
  ] as const)('rejects an invalid %s', async (property, value) => {
    const dto = plainToInstance(UpdateArticleDto, {
      expected_version: 1,
      [property]: value,
    });
    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property })]),
    );
  });
});
