// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { DeepPartial, EntityManager, Repository } from 'typeorm';

// import { Base } from '@/common/models/base.model';
// import { omitUndefinedDeep } from '@/common/helpers/typing.helper';

// import { ArticleEntity } from '../entities/article.entity';

// @Injectable()
// export class ArticleRepository {
//   public constructor(
//     @InjectRepository(ArticleEntity)
//     private readonly repository: Repository<ArticleEntity>,
//   ) {}

//   private getRepository(manager?: EntityManager): Repository<ArticleEntity> {
//     return manager ? manager.getRepository(ArticleEntity) : this.repository;
//   }

//   public async findAll(manager?: EntityManager): Promise<ArticleEntity[]> {
//     const repository = this.getRepository(manager);

//     return repository.find({ order: { createdAt: 'DESC', id: 'DESC' } });
//   }

//   public async findById(
//     id: string,
//     manager?: EntityManager,
//   ): Promise<ArticleEntity | null> {
//     const repository = this.getRepository(manager);

//     return repository.findOne({ where: { id } });
//   }

//   public async create(
//     payload: DeepPartial<Base<ArticleEntity>>,
//     manager?: EntityManager,
//   ): Promise<ArticleEntity> {
//     const repository = this.getRepository(manager);
//     const article = repository.create({
//       ...omitUndefinedDeep(payload),
//       media: { ...payload.media, hero: payload.media?.hero ?? null },
//       publication: {
//         ...payload.publication,
//         publisher: payload.publication?.publisher ?? null,
//         publishedAt: payload.publication?.publishedAt ?? null,
//       },
//     });
//     const created = await repository.save(article);

//     return repository.findOneByOrFail({ id: created.id });
//   }

//   public async update(
//     article: ArticleEntity,
//     payload: DeepPartial<Base<ArticleEntity>>,
//     manager?: EntityManager,
//   ): Promise<ArticleEntity> {
//     const repository = this.getRepository(manager);
//     const updated = repository.merge(article, omitUndefinedDeep(payload));

//     // TypeORM merge retains loaded relations when the replacement is null.
//     if (payload.media?.hero === null)
//       Object.assign(updated.media, { hero: null });
//     if (payload.publication?.publisher === null)
//       Object.assign(updated.publication, { publisher: null });

//     await repository.save(updated);

//     return repository.findOneByOrFail({ id: updated.id });
//   }

//   public async remove(
//     article: ArticleEntity,
//     manager?: EntityManager,
//   ): Promise<ArticleEntity> {
//     const repository = this.getRepository(manager);
//     await repository.delete({ id: article.id });

//     return article;
//   }
// }
