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
};

const COUNTRY_SEEDS: CountrySeed[] = [
  {
    key: 'canada',
    label: 'Canada',
    iso2: 'CA',
    iso3: 'CAN',
    calling_code: '1',
  },
  {
    key: 'australia',
    label: 'Australia',
    iso2: 'AU',
    iso3: 'AUS',
    calling_code: '61',
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
