import { DataSource, Repository } from 'typeorm';

import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

type GenderSeed = {
  key: string;
  label: string;
};

const GENDER_SEEDS: GenderSeed[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
  { key: 'other', label: 'Other' },
];

export class GenderSeeder implements Seeder {
  public readonly name: string = GenderSeeder.name;
  public readonly order: number = 10;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const repository: Repository<GenderEntity> =
      dataSource.getRepository(GenderEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of GENDER_SEEDS) {
      const existingGender: GenderEntity | null = await repository.findOne({
        where: { key: seed.key },
      });

      if (existingGender) {
        skipped += 1;
        continue;
      }

      const gender: GenderEntity = repository.create(seed);

      await repository.save(gender);

      created += 1;
    }

    return { created, skipped };
  }
}
