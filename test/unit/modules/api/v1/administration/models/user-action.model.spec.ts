import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserAdministrationActionDto } from '@/modules/api/v1/administration/models/user-action.model';
import { UpdateUserAdministrationDto } from '@/modules/api/v1/administration/models/update-user.model';
import { UserAdministrationDto } from '@/modules/domain/identity/models/user-administration.model';
import { UserDto } from '@/modules/domain/identity/models/user.model';
import { userFixture } from '@/../test/helpers/identity.fixtures';

describe('user administration concurrency contracts', () => {
  it.each([UserAdministrationActionDto, UpdateUserAdministrationDto])(
    'requires a valid revision for %p',
    async (model) => {
      expect(
        await validate(
          plainToInstance(model, {
            expected_version: 2,
            reason_code: 'access_review',
          }),
        ),
      ).toEqual([]);
      for (const expected_version of [
        undefined,
        null,
        '2',
        0,
        -1,
        1.5,
        4294967296,
      ]) {
        expect(
          await validate(
            plainToInstance(model, {
              expected_version,
              reason_code: 'access_review',
            }),
          ),
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ property: 'expected_version' }),
          ]),
        );
      }
    },
  );
  it('exposes the revision only in administration user responses', () => {
    const user = userFixture({ administration_version: 7 });
    expect(new UserAdministrationDto(user).version).toBe(7);
    expect(new UserDto(user)).not.toHaveProperty('version');
  });
});
