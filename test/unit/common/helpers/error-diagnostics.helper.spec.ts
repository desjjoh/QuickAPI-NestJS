import { QueryFailedError } from 'typeorm';
import { errorDiagnostics } from '@/common/helpers/error-diagnostics.helper';

describe('safe error diagnostics', () => {
  it('keeps only known SQL codes and a non-reversible frame fingerprint', () => {
    const error = new QueryFailedError(
      'INSERT credentials secret SQL',
      ['password', 'private@example.test'],
      Object.assign(new Error('private@example.test password'), {
        code: 'ER_DUP_ENTRY',
      }),
    );
    const result = errorDiagnostics(error);
    expect(result).toEqual({
      errorType: 'QueryFailedError',
      errorCode: 'ER_DUP_ENTRY',
      errorFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(result)).not.toMatch(
      /password|private@|INSERT|credentials/,
    );
  });

  it('does not trust names/codes or serialize provider response bodies', () => {
    const result = errorDiagnostics({
      name: 'Bearer secret',
      code: 'private@example.test',
      statusCode: 502,
      response: { body: 'secret password' },
      request: { Authorization: 'secret' },
    });
    expect(result).toEqual({ errorType: 'UnknownError', upstreamStatus: 502 });
  });

  it.each([
    undefined,
    null,
    'secret',
    {
      get name() {
        throw new Error('secret');
      },
    },
  ])('handles nonstandard thrown values safely', (error) => {
    expect(errorDiagnostics(error)).toEqual({ errorType: 'UnknownError' });
  });
});
