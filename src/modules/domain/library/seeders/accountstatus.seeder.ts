import { DataSource, Repository } from 'typeorm';

import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

import { AccountStatusEntity } from '../entities/accountstatus.entity';

export type AccountStatusSeed = {
  key: string;
  label: string;
  description: string;
};

export const ACCOUNT_STATUS_SEEDS: AccountStatusSeed[] = [
  {
    key: 'active',
    label: 'Active',
    description: 'The account is active and may authenticate normally.',
  },
  {
    key: 'pending_verification',
    label: 'Pending Verification',
    description:
      'The account has been created but still requires email verification.',
  },
  {
    key: 'disabled',
    label: 'Disabled',
    description:
      'The account has been disabled by an administrator and may not authenticate.',
  },
  {
    key: 'locked',
    label: 'Locked',
    description:
      'The account is temporarily locked due to security or policy reasons.',
  },
];

export class AccountStatusSeeder implements Seeder {
  public readonly name: string = AccountStatusSeeder.name;
  public readonly order: number = 15;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const repository: Repository<AccountStatusEntity> =
      dataSource.getRepository(AccountStatusEntity);

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
