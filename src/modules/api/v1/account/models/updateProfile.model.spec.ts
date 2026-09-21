import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateProfileDto } from './updateProfile.model';

describe('UpdateProfileDto', () => {
  const dto = (overrides: Partial<UpdateProfileDto> = {}) =>
    plainToInstance(UpdateProfileDto, {
      first_name: 'Pat',
      last_name: 'Example',
      preferred_name: null,
      dob: '1990-01-01',
      gender_id: 'SUwDyXR7iSBnyWmr',
      bio: null,
      ...overrides,
    });

  it('converts empty optional strings to null before validation', async () => {
    const transformed = dto({ preferred_name: '', bio: '' });

    expect(transformed.preferred_name).toBeNull();
    expect(transformed.bio).toBeNull();
    await expect(validate(transformed)).resolves.toEqual([]);
  });

  it.each(['preferred_name', 'bio'] as const)(
    'rejects an untransformed empty %s',
    async (property) => {
      const untransformed = Object.assign(dto(), { [property]: '' });
      const errors = await validate(untransformed);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property,
            constraints: expect.objectContaining({
              isNotEmpty: expect.any(String),
            }),
          }),
        ]),
      );
    },
  );

  it('continues to allow null preferred names and bios', async () => {
    await expect(validate(dto())).resolves.toEqual([]);
  });
});
