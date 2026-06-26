import { DataSource, Repository } from 'typeorm';

import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

type CountrySeed = {
  key: string;
  label: string;
  iso2: string;
  iso3: string;
  flag_url: string;
  calling_code: string;

  phone_national_placeholder: string;
  phone_national_pattern: string;
  phone_format_groups: number[];

  postal_code_placeholder: string;
  postal_code_pattern: string;
  postal_code_format_groups: number[];
  postal_code_format_separator: string;
};

const COUNTRY_SEEDS: CountrySeed[] = [
  {
    key: 'canada',
    label: 'Canada',
    iso2: 'CA',
    iso3: 'CAN',
    flag_url: '/flags/canada.svg',
    calling_code: '1',
    phone_national_placeholder: '2015550123',
    phone_national_pattern: '^[2-9]\\d{2}[2-9]\\d{6}$',
    phone_format_groups: [3, 3, 4],
    postal_code_placeholder: 'K1A0B1',
    postal_code_pattern:
      '^[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z][ -]?\\d[ABCEGHJ-NPRSTV-Z]\\d$',
    postal_code_format_groups: [3, 3],
    postal_code_format_separator: ' ',
  },
  {
    key: 'australia',
    label: 'Australia',
    iso2: 'AU',
    iso3: 'AUS',
    flag_url: '/flags/australia.svg',
    calling_code: '61',
    phone_national_placeholder: '412345678',
    phone_national_pattern: '^[23478]\\d{8}$',
    phone_format_groups: [3, 3, 3],
    postal_code_placeholder: '2000',
    postal_code_pattern: '^\\d{4}$',
    postal_code_format_groups: [4],
    postal_code_format_separator: '',
  },
];

export class CountrySeeder implements Seeder {
  public readonly name: string = CountrySeeder.name;
  public readonly order: number = 20;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const repository: Repository<CountryEntity> =
      dataSource.getRepository(CountryEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of COUNTRY_SEEDS) {
      const existingCountry: CountryEntity | null = await repository.findOne({
        where: { key: seed.key },
      });

      if (existingCountry) {
        skipped += 1;
        continue;
      }

      const country: CountryEntity = repository.create(seed);

      await repository.save(country);

      created += 1;
    }

    return { created, skipped };
  }
}
