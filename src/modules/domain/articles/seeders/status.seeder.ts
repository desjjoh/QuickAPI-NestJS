import { EntityManager, Repository } from 'typeorm';

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

export const ARTICLE_STATUS_KEYS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type ArticleStatusKey =
  (typeof ARTICLE_STATUS_KEYS)[keyof typeof ARTICLE_STATUS_KEYS];

export const ARTICLE_STATUS_SEEDS: ArticleStatusSeed[] = [
  {
    key: ARTICLE_STATUS_KEYS.DRAFT,
    label: 'Draft',
    description:
      'The article is being written and has not been submitted for review.',
  },
  {
    key: ARTICLE_STATUS_KEYS.SUBMITTED,
    label: 'Submitted',
    description:
      'The article has been submitted and is waiting to be reviewed.',
  },
  {
    key: ARTICLE_STATUS_KEYS.PUBLISHED,
    label: 'Published',
    description: 'The article is published and available to readers.',
  },
  {
    key: ARTICLE_STATUS_KEYS.ARCHIVED,
    label: 'Archived',
    description:
      'The article has been removed from active publication and retained for historical reference.',
  },
];

export class ArticleStatusSeeder implements Seeder {
  public readonly name: string = ArticleStatusSeeder.name;
  public readonly order: number = 50;

  public async run(manager: EntityManager): Promise<SeederResult> {
    const repository: Repository<ArticleStatusEntity> =
      manager.getRepository(ArticleStatusEntity);

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
