import { DataSource, Repository } from 'typeorm';

import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

import { ArticleStatusEntity } from '../entities/articleStatus.entity';

export type ArticleStatusSeed = {
  key: string;
  label: string;
  description: string;
};

export const ARTICLE_STATUS_SEEDS: ArticleStatusSeed[] = [
  {
    key: 'draft',
    label: 'Draft',
    description:
      'The article is being written and has not been submitted for review.',
  },
  {
    key: 'submitted',
    label: 'Submitted',
    description:
      'The article has been submitted and is waiting to be reviewed.',
  },
  {
    key: 'published',
    label: 'Published',
    description: 'The article is published and available to readers.',
  },
  {
    key: 'archived',
    label: 'Archived',
    description:
      'The article has been removed from active publication and retained for historical reference.',
  },
];

export class ArticleStatusSeeder implements Seeder {
  public readonly name: string = ArticleStatusSeeder.name;
  public readonly order: number = 50;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const repository: Repository<ArticleStatusEntity> =
      dataSource.getRepository(ArticleStatusEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of ARTICLE_STATUS_SEEDS) {
      const existingStatus: ArticleStatusEntity | null =
        await repository.findOne({
          where: { key: seed.key },
        });

      if (existingStatus) {
        skipped += 1;
        continue;
      }

      const status: ArticleStatusEntity = repository.create(seed);

      await repository.save(status);

      created += 1;
    }

    return { created, skipped };
  }
}
