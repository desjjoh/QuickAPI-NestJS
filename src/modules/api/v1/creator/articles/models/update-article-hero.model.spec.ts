import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateArticleHeroDto } from './update-article-hero.model';

describe(UpdateArticleHeroDto.name, () => {
  it('accepts bounded alternative text', async () => {
    await expect(
      validate(
        plainToInstance(UpdateArticleHeroDto, {
          expected_version: 1,
          hero_alt_text: 'A descriptive article hero.',
        }),
      ),
    ).resolves.toEqual([]);
  });

  it.each([undefined, null, '', '  \n'])(
    'rejects missing or blank text: %s',
    async (hero_alt_text) => {
      const errors = await validate(
        plainToInstance(UpdateArticleHeroDto, {
          expected_version: 1,
          hero_alt_text,
        }),
      );
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'hero_alt_text' }),
        ]),
      );
    },
  );

  it.each([true, 'true'])(
    'accepts explicit decorative choice: %s',
    async (hero_decorative) => {
      const dto = plainToInstance(UpdateArticleHeroDto, {
        expected_version: 1,
        hero_decorative,
      });
      await expect(validate(dto)).resolves.toEqual([]);
      expect(dto.hero_decorative).toBe(true);
    },
  );

  it('parses multipart false without truthy string coercion', async () => {
    const dto = plainToInstance(UpdateArticleHeroDto, {
      expected_version: 1,
      hero_decorative: 'false',
      hero_alt_text: 'Description',
    });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.hero_decorative).toBe(false);
  });

  it.each(['yes', '1', 1, null, ['true']])(
    'rejects invalid decorative flag: %s',
    async (hero_decorative) => {
      const errors = await validate(
        plainToInstance(UpdateArticleHeroDto, {
          expected_version: 1,
          hero_decorative,
          hero_alt_text: 'Description',
        }),
      );
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'hero_decorative' }),
        ]),
      );
    },
  );

  it.each(['Description', '', '  '])(
    'rejects text on decorative heroes: %s',
    async (hero_alt_text) => {
      const errors = await validate(
        plainToInstance(UpdateArticleHeroDto, {
          expected_version: 1,
          hero_alt_text,
          hero_decorative: true,
        }),
      );
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'hero_alt_text' }),
        ]),
      );
    },
  );

  it('rejects oversized alternative text', async () => {
    const errors = await validate(
      plainToInstance(UpdateArticleHeroDto, {
        expected_version: 1,
        hero_alt_text: 'x'.repeat(256),
      }),
    );

    expect(errors).toEqual([
      expect.objectContaining({ property: 'hero_alt_text' }),
    ]);
  });
});
