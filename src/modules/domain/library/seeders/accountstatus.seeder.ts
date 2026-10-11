import { EntityManager, Repository } from 'typeorm';

import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

import { AccountStatusEntity } from '../entities/accountstatus.entity';
import { ACCOUNT_STATUSES } from '@/config/statuses.config';

export type AccountStatusSeed = {
  key: string;
  label: string;
  description: string;
};

export const ACCOUNT_STATUS_SEEDS: AccountStatusSeed[] = ACCOUNT_STATUSES;

export class AccountStatusSeeder implements Seeder {
  public readonly name: string = AccountStatusSeeder.name;
  public readonly order: number = 15;

  public async run(manager: EntityManager): Promise<SeederResult> {
    const repository: Repository<AccountStatusEntity> =
      manager.getRepository(AccountStatusEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of ACCOUNT_STATUS_SEEDS) {
      const existingStatus: AccountStatusEntity | null =
        await repository.findOne({
          where: { key: seed.key },
        });

      if (existingStatus) {
        skipped += 1;
        continue;
      }

      const status: AccountStatusEntity = repository.create(seed);

      await repository.save(status);

      created += 1;
    }

    return { created, skipped };
  }
}
