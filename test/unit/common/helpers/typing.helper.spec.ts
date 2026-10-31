import { omitUndefinedDeep } from '@/common/helpers/typing.helper';

describe('omitUndefinedDeep', () => {
  it('preserves dates and explicit nulls while omitting nested undefined values', () => {
    const updatedAt = new Date('2026-10-07T12:00:00.000Z');
    const payload = {
      content: { title: 'Example', summary: undefined },
      details: { updatedAt, owner: null, status: undefined },
      media: undefined,
    };

    const result = omitUndefinedDeep(payload);

    expect(result).toEqual({
      content: { title: 'Example' },
      details: { updatedAt, owner: null },
    });
    expect(result.details.updatedAt).toBe(updatedAt);
    expect(payload.content).toHaveProperty('summary');
  });
});
