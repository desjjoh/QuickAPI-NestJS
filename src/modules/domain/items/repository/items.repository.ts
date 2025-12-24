import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ItemEntity } from '../entities/item.entity';
import { Base } from '@/library/models/base.model';

@Injectable()
export class ItemsRepository {
  constructor(
    @InjectRepository(ItemEntity)
    private readonly repo: Repository<ItemEntity>,
  ) {}

  // CREATE
  public async create(payload: Base<ItemEntity>): Promise<ItemEntity> {
    const item = this.repo.create({ ...payload });

    await this.repo.save(item);

    return this.repo.findOneOrFail({ where: { id: item.id } });
  }

  // READ
  public async findOneById(id: string): Promise<ItemEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  public async findAll(): Promise<ItemEntity[]> {
    return this.repo.find();
  }

  public async findPaginatedAndCount(): Promise<[ItemEntity[], number]> {
    return this.repo.findAndCount();
  }

  // UPDATE
  public async update(
    item: ItemEntity,
    payload: Partial<Base<ItemEntity>>,
  ): Promise<ItemEntity> {
    const updated = Object.assign(item, payload);

    await this.repo.save(updated);

    return this.repo.findOneOrFail({ where: { id: item.id } });
  }

  // DELETE
  public async remove(item: ItemEntity): Promise<ItemEntity> {
    return this.repo.remove(item);
  }
}
