import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateArticleDto } from '@/modules/api/v1/articles/models/create-article.model';
import { UpdateArticleDto } from '@/modules/api/v1/articles/models/update-article.model';

describe.each([CreateArticleDto, UpdateArticleDto])(
  '%s content validation',
  (Dto: new () => object) => {
    const valid = {
      title: 'Title',
      summary: 'Summary',
      body: 'Body',
      hero_alt_text: 'Hero description',
      expected_version: 1,
    };

    it.each([
      ['ASCII', 'a'.repeat(65_535)],
      ['three-byte characters', '漢'.repeat(21_845)],
      ['four-byte characters', '😀'.repeat(16_383) + 'abc'],
    ])('accepts exactly 65,535 UTF-8 bytes of %s', async (_label, body) => {
      expect(Buffer.byteLength(body, 'utf8')).toBe(65_535);
      expect(await validate(plainToInstance(Dto, { ...valid, body }))).toEqual(
        [],
      );
    });

    it.each([
      ['ASCII', 'a'.repeat(65_536)],
      ['three-byte characters', '漢'.repeat(21_845) + 'a'],
      ['four-byte characters', '😀'.repeat(16_383) + 'abcd'],
      ['short character count', '漢'.repeat(30_000)],
    ])('rejects oversized UTF-8 content with %s', async (_label, body) => {
      expect(await validate(plainToInstance(Dto, { ...valid, body }))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'body',
            constraints: expect.objectContaining({
              maxUtf8Bytes: expect.any(String),
            }),
          }),
        ]),
      );
    });

    it.each(['title', 'summary', 'body'])(
      'rejects explicit null for %s',
      async (property) => {
        expect(
          await validate(plainToInstance(Dto, { ...valid, [property]: null })),
        ).toEqual(
          expect.arrayContaining([expect.objectContaining({ property })]),
        );
      },
    );
  },
);

describe('omitted article content', () => {
  it('allows omitted update fields', async () => {
    expect(
      await validate(
        plainToInstance(UpdateArticleDto, { expected_version: 1 }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(UpdateArticleDto, {
          expected_version: 1,
          title: 'New title',
        }),
      ),
    ).toEqual([]);
  });

  it.each(['title', 'summary', 'body'])(
    'requires %s on creation',
    async (property) => {
      const input: Record<string, unknown> = {
        title: 'Title',
        summary: 'Summary',
        body: 'Body',
        hero_alt_text: 'Hero',
      };
      delete input[property];
      expect(await validate(plainToInstance(CreateArticleDto, input))).toEqual(
        expect.arrayContaining([expect.objectContaining({ property })]),
      );
    },
  );
});
