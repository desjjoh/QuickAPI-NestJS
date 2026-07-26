import { LibraryService } from './library.service';

describe('LibraryService', () => {
  const countryRepo = { findAll: jest.fn() };
  const genderRepo = { findAll: jest.fn() };
  const roleRepo = { findAll: jest.fn() };
  const statusRepo = { findAll: jest.fn() };
  const timezoneRepo = { findAll: jest.fn() };
  const service = new LibraryService(
    countryRepo as never,
    genderRepo as never,
    roleRepo as never,
    statusRepo as never,
    timezoneRepo as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['getGenders', genderRepo, { id: '1', key: 'female', label: 'Female' }],
    [
      'getRoles',
      roleRepo,
      {
        id: '1',
        key: 'admin',
        label: 'Admin',
        description: null,
        permissions: [],
      },
    ],
    [
      'getAccountStatuses',
      statusRepo,
      { id: '1', key: 'active', label: 'Active', description: null },
    ],
    [
      'getTimezones',
      timezoneRepo,
      {
        id: '1',
        key: 'UTC',
        label: 'UTC',
        long_name: 'UTC',
        region: 'Etc',
        exemplar_city: 'UTC',
      },
    ],
  ] as const)(
    'maps repository entities for %s',
    async (method, repo, entity) => {
      repo.findAll.mockResolvedValue([entity]);

      const result = await service[method]();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ key: entity.key, label: entity.label }),
      );
    },
  );

  it('maps countries and their reference regions', async () => {
    countryRepo.findAll.mockResolvedValue([
      {
        id: '1',
        key: 'canada',
        label: 'Canada',
        iso2: 'CA',
        iso3: 'CAN',
        flag_url: '/flags/ca.svg',
        calling_code: '1',
        regions: [
          {
            id: 'r',
            key: 'ontario',
            code: 'ON',
            label: 'Ontario',
            country: { key: 'canada' },
          },
        ],
        phone_national_placeholder: '',
        phone_national_pattern: '',
        phone_format_groups: [],
        postal_code_placeholder: '',
        postal_code_pattern: '',
        postal_code_format_groups: [],
        postal_code_format_separator: ' ',
      },
    ]);

    const result = await service.getCountries();

    expect(result[0]).toEqual(
      expect.objectContaining({
        key: 'canada',
        regions: [
          expect.objectContaining({ key: 'ontario', country: 'canada' }),
        ],
      }),
    );
  });

  it('returns an empty collection when reference records are absent', async () => {
    genderRepo.findAll.mockResolvedValue([]);
    await expect(service.getGenders()).resolves.toEqual([]);
  });

  it('propagates repository connection errors', async () => {
    const error = new Error('mysql unavailable');
    roleRepo.findAll.mockRejectedValue(error);
    await expect(service.getRoles()).rejects.toBe(error);
  });
});
