import { omitUndefinedDeep } from './typing.helper';

describe('omitUndefinedDeep', () => {
  it('preserves dates and explicit nulls while omitting nested undefined values', () => {
    const publishedAt = new Date('2026-10-07T12:00:00.000Z');
    const payload = {
      content: { title: 'Article', summary: undefined },
      publication: { publishedAt, publisher: null, status: undefined },
      media: undefined,
    };

    const result = omitUndefinedDeep(payload);

    expect(result).toEqual({
      content: { title: 'Article' },
      publication: { publishedAt, publisher: null },
    });
    expect(result.publication.publishedAt).toBe(publishedAt);
    expect(payload.content).toHaveProperty('summary');
  });
});
