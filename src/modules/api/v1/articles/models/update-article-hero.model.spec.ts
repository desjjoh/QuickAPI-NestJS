import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateArticleHeroDto } from './update-article-hero.model';

describe(UpdateArticleHeroDto.name, () => {
  it('accepts omitted or bounded alternative text', async () => {
    await expect(validate(new UpdateArticleHeroDto())).resolves.toEqual([]);
    await expect(
      validate(
        plainToInstance(UpdateArticleHeroDto, {
          hero_alt_text: 'A descriptive article hero.',
        }),
      ),
    ).resolves.toEqual([]);
  });

  it('rejects oversized alternative text', async () => {
    const errors = await validate(
      plainToInstance(UpdateArticleHeroDto, {
        hero_alt_text: 'x'.repeat(256),
      }),
    );

    expect(errors).toEqual([
      expect.objectContaining({ property: 'hero_alt_text' }),
    ]);
  });
});
