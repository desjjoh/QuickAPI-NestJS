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
  calling_code: string;

  phone_national_placeholder: string;
  phone_national_pattern: string;
  phone_format_groups: number[];
};

const COUNTRY_SEEDS: CountrySeed[] = [
  {
    key: 'canada',
    label: 'Canada',
    iso2: 'CA',
    iso3: 'CAN',
    calling_code: '1',
    phone_national_placeholder: '2015550123',
    phone_national_pattern: '^[2-9]\\d{2}[2-9]\\d{6}$',
    phone_format_groups: [3, 3, 4],
  },
  {
    key: 'australia',
    label: 'Australia',
    iso2: 'AU',
    iso3: 'AUS',
    calling_code: '61',
    phone_national_placeholder: '412345678',
    phone_national_pattern: '^[23478]\\d{8}$',
    phone_format_groups: [3, 3, 3],
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
