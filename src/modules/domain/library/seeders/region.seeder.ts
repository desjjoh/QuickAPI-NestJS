import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';
import { DataSource, Repository } from 'typeorm';

type RegionSeed = {
  key: string;
  code: string;
  label: string;
  country: string;
};

export const REGION_SEEDS: RegionSeed[] = [
  { country: 'canada', key: 'alberta', code: 'AB', label: 'Alberta' },
  {
    country: 'canada',
    key: 'british_columbia',
    code: 'BC',
    label: 'British Columbia',
  },
  { country: 'canada', key: 'manitoba', code: 'MB', label: 'Manitoba' },
  {
    country: 'canada',
    key: 'new_brunswick',
    code: 'NB',
    label: 'New Brunswick',
  },
  {
    country: 'canada',
    key: 'newfoundland_and_labrador',
    code: 'NL',
    label: 'Newfoundland and Labrador',
  },
  { country: 'canada', key: 'nova_scotia', code: 'NS', label: 'Nova Scotia' },
  {
    country: 'canada',
    key: 'northwest_territories',
    code: 'NT',
    label: 'Northwest Territories',
  },
  { country: 'canada', key: 'nunavut', code: 'NU', label: 'Nunavut' },
  { country: 'canada', key: 'ontario', code: 'ON', label: 'Ontario' },
  {
    country: 'canada',
    key: 'prince_edward_island',
    code: 'PE',
    label: 'Prince Edward Island',
  },
  { country: 'canada', key: 'quebec', code: 'QC', label: 'Quebec' },
  {
    country: 'canada',
    key: 'saskatchewan',
    code: 'SK',
    label: 'Saskatchewan',
  },
  { country: 'canada', key: 'yukon', code: 'YT', label: 'Yukon' },
  {
    country: 'australia',
    key: 'australian_capital_territory',
    code: 'ACT',
    label: 'Australian Capital Territory',
  },
  {
    country: 'australia',
    key: 'new_south_wales',
    code: 'NSW',
    label: 'New South Wales',
  },
  {
    country: 'australia',
    key: 'northern_territory',
    code: 'NT',
    label: 'Northern Territory',
  },
  { country: 'australia', key: 'queensland', code: 'QLD', label: 'Queensland' },
  {
    country: 'australia',
    key: 'south_australia',
    code: 'SA',
    label: 'South Australia',
  },
  { country: 'australia', key: 'tasmania', code: 'TAS', label: 'Tasmania' },
  { country: 'australia', key: 'victoria', code: 'VIC', label: 'Victoria' },
  {
    country: 'australia',
    key: 'western_australia',
    code: 'WA',
    label: 'Western Australia',
  },
];

export class RegionSeeder implements Seeder {
  public readonly name: string = RegionSeeder.name;
  public readonly order: number = 25;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const regionRepository: Repository<RegionEntity> =
      dataSource.getRepository(RegionEntity);
    const countryRepository: Repository<CountryEntity> =
      dataSource.getRepository(CountryEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of REGION_SEEDS) {
      const country: CountryEntity | null = await countryRepository.findOne({
        where: { key: seed.country },
      });

      if (!country) {
        throw new Error(
          `Region seed "${seed.key}" references missing country: ${seed.country}`,
        );
      }

      const existingRegion: RegionEntity | null =
        await regionRepository.findOne({
          where: { key: seed.key, country: { id: country.id } },
        });

      if (existingRegion) {
        skipped += 1;
        continue;
      }

      const region: RegionEntity = regionRepository.create({
        key: seed.key,
        code: seed.code,
        label: seed.label,
        country,
      });

      await regionRepository.save(region);

      created += 1;
    }

    return { created, skipped };
  }
}
