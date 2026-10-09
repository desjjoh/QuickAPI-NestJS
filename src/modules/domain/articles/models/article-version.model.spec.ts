import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ArticleVersionDto } from './article-version.model';

describe('article version precondition', () => {
  it.each([1, 42, '1', '42'])(
    'accepts a positive version: %s',
    async (expected_version) => {
      const dto = plainToInstance(ArticleVersionDto, { expected_version });
      expect(await validate(dto)).toEqual([]);
      expect(dto.expected_version).toBe(Number(expected_version));
    },
  );
  it.each([
    undefined,
    null,
    '',
    ' ',
    0,
    -1,
    1.5,
    true,
    '1.5',
    '1e2',
    'abc',
    ['1'],
    4294967296,
  ])('rejects missing or invalid versions: %s', async (expected_version) => {
    expect(
      await validate(plainToInstance(ArticleVersionDto, { expected_version })),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'expected_version' }),
      ]),
    );
  });
});
