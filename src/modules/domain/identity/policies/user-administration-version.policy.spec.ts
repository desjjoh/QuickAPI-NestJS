import { BadRequestException, ConflictException } from '@nestjs/common';
import { assertUserAdministrationVersion } from './user-administration-version.policy';
import { userFixture } from '@/../test/helpers/identity.fixtures';

describe('administration user revision', () => {
  it('accepts the current revision without mutating the user', () => {
    const user = userFixture({ administration_version: 3 });
    expect(() => assertUserAdministrationVersion(user, 3)).not.toThrow();
    expect(user.administration_version).toBe(3);
  });
  it.each([undefined, null, '3', 0, -1, 1.5, NaN, Infinity, 4294967296])(
    'rejects invalid expected_version %j',
    (value) => {
      expect(() =>
        assertUserAdministrationVersion(userFixture(), value as number),
      ).toThrow(BadRequestException);
    },
  );
  it.each([1, 4])('rejects a non-current revision %i', (value) => {
    expect(() =>
      assertUserAdministrationVersion(
        userFixture({ administration_version: 3 }),
        value,
      ),
    ).toThrow(ConflictException);
  });
});
