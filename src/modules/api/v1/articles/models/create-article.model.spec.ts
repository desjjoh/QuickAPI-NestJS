import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateArticleDto } from './create-article.model';

describe('CreateArticleDto', () => {
  const valid = {
    title: 'Title',
    summary: 'Summary',
    body: 'Body',
    hero_alt_text: 'Hero description',
  };

  it('accepts complete bounded article content', async () => {
    await expect(
      validate(plainToInstance(CreateArticleDto, valid)),
    ).resolves.toEqual([]);
  });

  it('requires an explicit accessibility choice on creation', async () => {
    const content = {
      title: valid.title,
      summary: valid.summary,
      body: valid.body,
    };
    expect(await validate(plainToInstance(CreateArticleDto, content))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'hero_alt_text' }),
      ]),
    );
    await expect(
      validate(
        plainToInstance(CreateArticleDto, {
          ...content,
          hero_decorative: 'true',
        }),
      ),
    ).resolves.toEqual([]);
  });

  it.each([
    ['title', '   '],
    ['summary', 'x'.repeat(256)],
    ['body', '\n\t'],
    ['hero_alt_text', 'x'.repeat(256)],
  ] as const)('rejects an invalid %s', async (property, value) => {
    const dto = plainToInstance(CreateArticleDto, {
      ...valid,
      [property]: value,
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property })]),
    );
  });
});
